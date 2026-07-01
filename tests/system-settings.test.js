import { describe, test, expect, beforeAll, beforeEach } from 'vitest';
import { createTestApp } from './helpers/app.js';
import { createUser } from './helpers/fixtures.js';
import { loginAs } from './helpers/auth.js';
import {
  ensureSingleton,
  invalidateCache,
} from '../src/services/systemSettings.js';
import { systemSettingsDefaults } from '../src/constants/systemSettingsDefaults.js';

describe('system settings', () => {
  let app;
  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    // SystemSettings is a singleton in the DB; cache + collection
    // both reset between tests so each case sees a clean baseline.
    invalidateCache();
    await ensureSingleton();
  });

  test('GET /system-settings exposes only the public-view fields', async () => {
    const created = await createUser({ role: 'manager' });
    const agent = await loginAs(app, created);

    const res = await agent.get('/system-settings');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      timezone: systemSettingsDefaults.timezone,
      workDays: systemSettingsDefaults.workDays,
      slotDurationMinutes: systemSettingsDefaults.slotDurationMinutes,
    });
    expect(res.body.workHours).toBeDefined();
    // Internal-only fields shouldn't leak — these come from the
    // PUBLIC_FIELDS allowlist in services/systemSettings.js.
    expect(res.body.email).toBeUndefined();
    expect(res.body.retention).toBeUndefined();
    expect(res.body.updatedBy).toBeUndefined();
  });

  test('GET /system-settings requires authentication', async () => {
    const res = await (await import('supertest')).default(app).get('/system-settings');
    expect(res.status).toBe(401);
  });

  test('admin PATCH updates timezone and the public GET reflects it', async () => {
    const created = await createUser({ role: 'admin' });
    const agent = await loginAs(app, created);

    const patch = await agent
      .patch('/system-settings')
      .send({ timezone: 'Europe/Warsaw' });

    expect(patch.status).toBe(200);
    expect(patch.body.timezone).toBe('Europe/Warsaw');

    const reread = await agent.get('/system-settings');
    expect(reread.body.timezone).toBe('Europe/Warsaw');
  });

  test('non-admin cannot PATCH (403)', async () => {
    const created = await createUser({ role: 'manager' });
    const agent = await loginAs(app, created);

    const res = await agent
      .patch('/system-settings')
      .send({ timezone: 'Europe/Warsaw' });

    expect(res.status).toBe(403);
  });

  test('malformed timezone (no slash) is rejected at the Joi layer (400)', async () => {
    const created = await createUser({ role: 'admin' });
    const agent = await loginAs(app, created);

    // The Joi pattern enforces a 'Region/City' shape — anything
    // without a slash fails fast before reaching Mongoose's IANA
    // check (which still catches well-formed-but-unknown zones).
    const res = await agent
      .patch('/system-settings')
      .send({ timezone: 'NotATimeZone' });

    expect(res.status).toBe(400);
  });

  const fullWeek = () => ({
    mon: { enabled: true, start: '00:00', end: '23:59' },
    tue: { enabled: true, start: '00:00', end: '23:59' },
    wed: { enabled: true, start: '00:00', end: '23:59' },
    thu: { enabled: true, start: '00:00', end: '23:59' },
    fri: { enabled: true, start: '00:00', end: '23:59' },
    sat: { enabled: true, start: '08:00', end: '12:00' },
    sun: { enabled: false, start: '08:00', end: '17:00' },
  });

  test('public view exposes weekSchedule (defaults: Mon–Fri on, weekend off)', async () => {
    const agent = await loginAs(app, await createUser({ role: 'manager' }));
    const res = await agent.get('/system-settings');
    expect(res.status).toBe(200);
    expect(res.body.weekSchedule?.mon?.enabled).toBe(true);
    expect(res.body.weekSchedule?.sat?.enabled).toBe(false);
  });

  test('admin sets a per-day schedule (24/5 + Saturday morning)', async () => {
    const admin = await loginAs(app, await createUser({ role: 'admin' }));

    const patch = await admin
      .patch('/system-settings')
      .send({ weekSchedule: fullWeek() });
    expect(patch.status).toBe(200);

    const full = await admin.get('/system-settings/full');
    expect(full.body.weekSchedule.sat).toMatchObject({
      enabled: true,
      start: '08:00',
      end: '12:00',
    });
    expect(full.body.weekSchedule.mon).toMatchObject({
      enabled: true,
      start: '00:00',
      end: '23:59',
    });
    expect(full.body.weekSchedule.sun.enabled).toBe(false);
  });

  test('rejects a day whose end is not after start (400)', async () => {
    const admin = await loginAs(app, await createUser({ role: 'admin' }));
    const res = await admin.patch('/system-settings').send({
      weekSchedule: { ...fullWeek(), sat: { enabled: true, start: '12:00', end: '08:00' } },
    });
    expect(res.status).toBe(400);
  });

  test('GET /system-settings/full requires admin', async () => {
    const manager = await loginAs(app, await createUser({ role: 'manager' }));
    const managerRes = await manager.get('/system-settings/full');
    expect(managerRes.status).toBe(403);

    const admin = await loginAs(app, await createUser({ role: 'admin' }));
    const adminRes = await admin.get('/system-settings/full');
    expect(adminRes.status).toBe(200);
    // Full view exposes the internal config the public view hides.
    expect(adminRes.body.email).toBeDefined();
    expect(adminRes.body.retention).toBeDefined();
  });
});
