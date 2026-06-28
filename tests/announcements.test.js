import { describe, test, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { createUser } from './helpers/fixtures.js';
import { loginAs } from './helpers/auth.js';
import { Announcement } from '../src/models/announcement.js';

const VALID = {
  title: 'Manutenzione programmata',
  body: 'Sabato impianto fermo.',
};

describe('announcements (public bacheca)', () => {
  let app;
  beforeAll(() => {
    app = createTestApp();
  });

  test('GET /public/announcements is public (no auth) and newest-first', async () => {
    const agent = await loginAs(app, await createUser({ role: 'manager' }));
    await agent.post('/announcements').send({ title: 'A', body: 'first' });
    await agent.post('/announcements').send({ title: 'B', body: 'second' });

    const res = await request(app).get('/public/announcements');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
    // Newest first — B was created after A.
    expect(res.body.items[0].title).toBe('B');
  });

  test('POST /announcements requires authentication (401)', async () => {
    const res = await request(app).post('/announcements').send(VALID);
    expect(res.status).toBe(401);
  });

  test('manager and admin can create (201); operator cannot (403)', async () => {
    const manager = await loginAs(app, await createUser({ role: 'manager' }));
    const admin = await loginAs(app, await createUser({ role: 'admin' }));
    const operator = await loginAs(app, await createUser({ role: 'operator' }));

    await manager.post('/announcements').send(VALID).expect(201);
    await admin.post('/announcements').send(VALID).expect(201);

    const res = await operator.post('/announcements').send(VALID);
    expect(res.status).toBe(403);
  });

  test('create rejects missing title/body (400)', async () => {
    const manager = await loginAs(app, await createUser({ role: 'manager' }));
    const res = await manager.post('/announcements').send({ title: '' });
    expect(res.status).toBe(400);
  });

  test('author or admin can delete; a non-author manager cannot (403)', async () => {
    const author = await loginAs(app, await createUser({ role: 'manager' }));
    const created = await author.post('/announcements').send(VALID).expect(201);
    const id = created.body._id;

    const otherManager = await loginAs(app, await createUser({ role: 'manager' }));
    const forbidden = await otherManager.delete(`/announcements/${id}`);
    expect(forbidden.status).toBe(403);

    const ok = await author.delete(`/announcements/${id}`);
    expect(ok.status).toBe(200);

    const gone = await Announcement.findById(id);
    expect(gone).toBeNull();
  });
});
