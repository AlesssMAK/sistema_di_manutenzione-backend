import { describe, test, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { createUser } from './helpers/fixtures.js';
import { loginAs } from './helpers/auth.js';
import { PushSubscription } from '../src/models/pushSubscription.js';
import { sendPushToUser, sendPushToRole } from '../src/services/push/index.js';

const SUB = {
  endpoint: 'https://push.example.com/sub/abc123',
  keys: { p256dh: 'BPp256dhKeyValue', auth: 'authKeyValue' },
  expirationTime: null,
};

describe('push subscriptions', () => {
  let app;
  beforeAll(() => {
    app = createTestApp();
  });

  test('POST /push/subscribe stores a subscription for the user', async () => {
    const created = await createUser({ role: 'manager' });
    const agent = await loginAs(app, created);

    const res = await agent.post('/push/subscribe').send(SUB);
    expect(res.status).toBe(201);

    const saved = await PushSubscription.findOne({ endpoint: SUB.endpoint });
    expect(saved).not.toBeNull();
    expect(String(saved.userId)).toBe(String(created.user._id));
    expect(saved.keys.auth).toBe(SUB.keys.auth);
  });

  test('re-subscribing the same endpoint upserts (no duplicate)', async () => {
    const created = await createUser({ role: 'manager' });
    const agent = await loginAs(app, created);

    await agent.post('/push/subscribe').send(SUB).expect(201);
    await agent.post('/push/subscribe').send(SUB).expect(201);

    const count = await PushSubscription.countDocuments({
      endpoint: SUB.endpoint,
    });
    expect(count).toBe(1);
  });

  test('POST /push/unsubscribe removes the subscription', async () => {
    const created = await createUser({ role: 'manager' });
    const agent = await loginAs(app, created);

    await agent.post('/push/subscribe').send(SUB).expect(201);
    const res = await agent
      .post('/push/unsubscribe')
      .send({ endpoint: SUB.endpoint });
    expect(res.status).toBe(200);

    const saved = await PushSubscription.findOne({ endpoint: SUB.endpoint });
    expect(saved).toBeNull();
  });

  test('subscribe rejects malformed payload (400)', async () => {
    const created = await createUser({ role: 'manager' });
    const agent = await loginAs(app, created);

    const res = await agent
      .post('/push/subscribe')
      .send({ endpoint: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  test('endpoints require authentication (401)', async () => {
    const anon = await request(app).post('/push/subscribe').send(SUB);
    expect(anon.status).toBe(401);
  });

  test('GET /push/public-key returns the configured key (null in tests)', async () => {
    const created = await createUser({ role: 'admin' });
    const agent = await loginAs(app, created);

    const res = await agent.get('/push/public-key');
    expect(res.status).toBe(200);
    // VAPID env isn't set in the test runner, so it's null — the
    // point is the endpoint responds and is admin-reachable.
    expect(res.body).toHaveProperty('publicKey');
  });

  test('sendPushToUser / sendPushToRole no-op without VAPID (no throw)', async () => {
    const created = await createUser({ role: 'maintenanceWorker' });
    // No VAPID env in tests → service short-circuits. Must resolve
    // quietly rather than throw, so trigger sites stay safe.
    await expect(
      sendPushToUser(created.user._id, { title: 't', body: 'b' })
    ).resolves.toBeUndefined();
    await expect(
      sendPushToRole('manager', { title: 't', body: 'b' })
    ).resolves.toBeUndefined();
  });
});
