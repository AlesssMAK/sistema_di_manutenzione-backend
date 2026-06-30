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

// A non-admin user explicitly granted the create permission.
const flaggedUser = (role = 'maintenanceWorker') =>
  createUser({ role, permissions: { canCreateAnnouncements: true } });

describe('announcements (public bacheca)', () => {
  let app;
  beforeAll(() => {
    app = createTestApp();
  });

  test('GET /public/announcements is public (no auth) and newest-first', async () => {
    const admin = await loginAs(app, await createUser({ role: 'admin' }));
    await admin.post('/announcements').send({ title: 'A', body: 'first' });
    await admin.post('/announcements').send({ title: 'B', body: 'second' });

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

  test('admin and flagged users can create (201); others cannot (403)', async () => {
    const admin = await loginAs(app, await createUser({ role: 'admin' }));
    const flagged = await loginAs(app, await flaggedUser());
    const manager = await loginAs(app, await createUser({ role: 'manager' }));

    await admin.post('/announcements').send(VALID).expect(201);
    await flagged.post('/announcements').send(VALID).expect(201);

    // Manager without the flag is no longer allowed (Phase 2).
    const denied = await manager.post('/announcements').send(VALID);
    expect(denied.status).toBe(403);
  });

  test('create rejects missing title/body (400)', async () => {
    const admin = await loginAs(app, await createUser({ role: 'admin' }));
    const res = await admin.post('/announcements').send({ title: '' });
    expect(res.status).toBe(400);
  });

  test('author or admin can delete; a non-author cannot (403)', async () => {
    const author = await loginAs(app, await flaggedUser());
    const created = await author.post('/announcements').send(VALID).expect(201);
    const id = created.body._id;

    const other = await loginAs(app, await createUser({ role: 'manager' }));
    const forbidden = await other.delete(`/announcements/${id}`);
    expect(forbidden.status).toBe(403);

    const ok = await author.delete(`/announcements/${id}`);
    expect(ok.status).toBe(200);

    const gone = await Announcement.findById(id);
    expect(gone).toBeNull();
  });

  test('GET /announcements/authors lists granted users (admin only)', async () => {
    const granted = await flaggedUser('safety');
    const admin = await loginAs(app, await createUser({ role: 'admin' }));

    const res = await admin.get('/announcements/authors');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    const ids = res.body.users.map((u) => String(u._id));
    expect(ids).toContain(String(granted.user._id));

    const manager = await loginAs(app, await createUser({ role: 'manager' }));
    const denied = await manager.get('/announcements/authors');
    expect(denied.status).toBe(403);
  });
});
