import { describe, test, expect, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { createTestApp } from './helpers/app.js';
import { createUser } from './helpers/fixtures.js';
import { loginAs } from './helpers/auth.js';
import { User } from '../src/models/user.js';
import { Session } from '../src/models/session.js';

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

// Set a reset token on a user directly, as forgot-password would.
const seedResetToken = async (user, { expiresInMs = 60 * 60 * 1000 } = {}) => {
  const raw = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = sha256(raw);
  user.resetPasswordExpires = new Date(Date.now() + expiresInMs);
  await user.save();
  return raw;
};

describe('auth', () => {
  let app;
  beforeAll(() => {
    app = createTestApp();
  });

  test('manager logs in with email + password, receives session cookies', async () => {
    const { user, password } = await createUser({ role: 'manager' });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);

    const cookies = res.headers['set-cookie'] ?? [];
    expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('sessionId='))).toBe(true);
  });

  test('operator logs in with fullName + personalCode (no password field)', async () => {
    const { user } = await createUser({
      role: 'operator',
      fullName: 'Mario Rossi',
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ fullName: 'Mario Rossi', personalCode: user.personalCode });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('operator');
  });

  test('login with wrong password returns 401', async () => {
    const { user } = await createUser({ role: 'manager' });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password: 'WrongPass99!' });

    expect(res.status).toBe(401);
  });

  test('deactivated user is blocked with 403', async () => {
    const { user, password } = await createUser({ role: 'manager' });
    user.status = 'deactivated';
    await user.save();

    const res = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password });

    expect(res.status).toBe(403);
  });

  test('logout clears cookies and drops the server-side session', async () => {
    const created = await createUser({ role: 'manager' });
    const agent = await loginAs(app, created);

    const before = await Session.countDocuments({ userId: created.user._id });
    expect(before).toBe(1);

    const res = await agent.post('/auth/logout');
    expect(res.status).toBe(204);

    const after = await Session.countDocuments({ userId: created.user._id });
    expect(after).toBe(0);
  });

  test('GET /users/me without cookies is 401, with cookies returns the user', async () => {
    const anon = await request(app).get('/users/me');
    expect(anon.status).toBe(401);

    const created = await createUser({ role: 'manager' });
    const agent = await loginAs(app, created);
    const res = await agent.get('/users/me');

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(created.user.email);
  });

  test('login swap: creating a second session deletes the first', async () => {
    const created = await createUser({ role: 'manager' });
    await loginAs(app, created);
    await loginAs(app, created);

    const count = await Session.countDocuments({ userId: created.user._id });
    expect(count).toBe(1);
  });

  test('User.toJSON hides password and personalCode', async () => {
    const { user } = await createUser({ role: 'operator' });
    const loaded = await User.findById(user._id);
    const json = loaded.toJSON();

    expect(json.password).toBeUndefined();
    expect(json.personalCode).toBeUndefined();
    expect(json.fullName).toBe(user.fullName);
  });

  test('forgot-password issues a token and returns a generic 200', async () => {
    const { user } = await createUser({ role: 'manager' });

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: user.email });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeTruthy();

    const reloaded = await User.findById(user._id);
    expect(reloaded.resetPasswordToken).toBeTruthy();
    expect(reloaded.resetPasswordExpires.getTime()).toBeGreaterThan(Date.now());

    // Unknown email → same generic 200 (no enumeration).
    const unknown = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'nobody-xyz@example.com' });
    expect(unknown.status).toBe(200);
  });

  test('reset-password sets the new password, clears the token, invalidates sessions', async () => {
    const created = await createUser({ role: 'manager' });
    const { user } = created;
    await loginAs(app, created); // create an active session
    const raw = await seedResetToken(user);

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: raw, password: 'NewPass99!' });
    expect(res.status).toBe(200);

    const reloaded = await User.findById(user._id);
    expect(reloaded.resetPasswordToken).toBeFalsy();
    expect(await bcrypt.compare('NewPass99!', reloaded.password)).toBe(true);
    expect(await Session.countDocuments({ userId: user._id })).toBe(0);

    const login = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password: 'NewPass99!' });
    expect(login.status).toBe(200);
  });

  test('reset-password rejects an invalid token (400)', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'not-a-real-token', password: 'NewPass99!' });
    expect(res.status).toBe(400);
  });

  test('reset-password rejects a weak password (400)', async () => {
    const { user } = await createUser({ role: 'manager' });
    const raw = await seedResetToken(user);

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: raw, password: 'alllowercase' }); // no upper/special
    expect(res.status).toBe(400);
  });

  test('operator email never receives a reset token', async () => {
    const { user } = await createUser({ role: 'operator' });

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: user.email });
    expect(res.status).toBe(200);

    const reloaded = await User.findById(user._id);
    expect(reloaded.resetPasswordToken).toBeUndefined();
  });
});
