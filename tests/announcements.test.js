import { describe, test, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { createUser, createPlant } from './helpers/fixtures.js';
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

  test('create defaults to category "announcement" when unspecified', async () => {
    const admin = await loginAs(app, await createUser({ role: 'admin' }));
    const res = await admin.post('/announcements').send(VALID).expect(201);
    expect(res.body.category).toBe('announcement');
    expect(res.body.plantId).toBeUndefined();
  });

  test('create "handover" with a machine denormalizes plantName', async () => {
    const admin = await loginAs(app, await createUser({ role: 'admin' }));
    const plant = await createPlant({ namePlant: 'Estrusore 3' });

    const res = await admin
      .post('/announcements')
      .send({ ...VALID, category: 'handover', plantId: String(plant._id) })
      .expect(201);

    expect(res.body.category).toBe('handover');
    expect(String(res.body.plantId)).toBe(String(plant._id));
    expect(res.body.plantName).toBe('Estrusore 3');
  });

  test('create "handover" with a non-existent machine is rejected (400)', async () => {
    const admin = await loginAs(app, await createUser({ role: 'admin' }));
    const res = await admin.post('/announcements').send({
      ...VALID,
      category: 'handover',
      plantId: '5f9f1b9b9b9b9b9b9b9b9b9b',
    });
    expect(res.status).toBe(400);
  });

  test('GET /public/announcements?category= filters by category', async () => {
    const admin = await loginAs(app, await createUser({ role: 'admin' }));
    const plant = await createPlant();
    await admin
      .post('/announcements')
      .send({ title: 'Turno', body: 'handover', category: 'handover', plantId: String(plant._id) })
      .expect(201);
    await admin
      .post('/announcements')
      .send({ title: 'Avviso', body: 'announcement', category: 'announcement' })
      .expect(201);

    const consegne = await request(app).get('/public/announcements?category=handover');
    expect(consegne.status).toBe(200);
    expect(consegne.body.items.length).toBeGreaterThanOrEqual(1);
    expect(consegne.body.items.every((a) => a.category === 'handover')).toBe(true);
  });

  test('severity defaults to "normale" and accepts a valid level', async () => {
    const admin = await loginAs(app, await createUser({ role: 'admin' }));

    const def = await admin.post('/announcements').send(VALID).expect(201);
    expect(def.body.severity).toBe('normal');

    const imp = await admin
      .post('/announcements')
      .send({ ...VALID, severity: 'important' })
      .expect(201);
    expect(imp.body.severity).toBe('important');
  });

  test('create rejects an invalid severity (400)', async () => {
    const admin = await loginAs(app, await createUser({ role: 'admin' }));
    const res = await admin
      .post('/announcements')
      .send({ ...VALID, severity: 'BOGUS' });
    expect(res.status).toBe(400);
  });

  test('legacy announcement without category counts as "announcement", never duplicated', async () => {
    const admin = await createUser({ role: 'admin' });
    // Raw insert bypasses the mongoose `category` default to simulate a
    // document created before the field existed.
    const { insertedId } = await Announcement.collection.insertOne({
      title: 'Legacy',
      body: 'no category field',
      authorId: admin.user._id,
      authorName: admin.user.fullName ?? 'X',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const annunci = await request(app).get('/public/announcements?category=announcement');
    const consegne = await request(app).get('/public/announcements?category=handover');

    const inAnnunci = annunci.body.items.some((a) => String(a._id) === String(insertedId));
    const inConsegne = consegne.body.items.some((a) => String(a._id) === String(insertedId));

    expect(inAnnunci).toBe(true);
    expect(inConsegne).toBe(false);
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
