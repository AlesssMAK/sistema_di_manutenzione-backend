import { describe, test, expect, beforeAll } from 'vitest';
import { createTestApp } from './helpers/app.js';
import { createPlant, createPlantPart, createUser } from './helpers/fixtures.js';
import { loginAs } from './helpers/auth.js';
import { Fault } from '../src/models/fault.js';

const isoDate = (o = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + o);
  return d.toISOString().slice(0, 10);
};

// Seed a fault directly via the model so each test can pin exactly the
// assignment + status it needs (bypasses the manager planning flow).
const seedFault = async ({ assignedMaintainers = [], statusFault = 'Created' } = {}) => {
  const plant = await createPlant();
  const part = await createPlantPart(plant);
  const op = await createUser({ role: 'operator' });
  return Fault.create({
    faultId: `SEG-2026-06-${Math.floor(Math.random() * 900 + 100)}`,
    userId: op.user._id,
    nameOperator: op.user.fullName,
    dataCreated: isoDate(),
    timeCreated: '09:00',
    plantId: plant._id,
    partId: part._id,
    typeFault: 'Production',
    comment: 'test fault comment',
    assignedMaintainers,
    statusFault,
  });
};

describe('unseen fault annotation', () => {
  let app;
  beforeAll(() => {
    app = createTestApp();
  });

  test('mine fault is unseen until marked seen (model B)', async () => {
    const w = await createUser({ role: 'maintenanceWorker', email: 'mine@example.com' });
    const agent = await loginAs(app, w);
    const fault = await seedFault({
      assignedMaintainers: [w.user._id],
      statusFault: 'In progress',
    });

    let res = await agent
      .get('/faults')
      .query({ assignedTo: w.user._id.toString(), withUnseen: 'true', perPage: 10 });
    expect(res.status).toBe(200);
    expect(res.body.hasUnseen).toBe(true);
    expect(res.body.fault[0].unseen).toBe(true);

    const seen = await agent.post(`/faults/${fault._id}/seen`);
    expect(seen.status).toBe(204);

    res = await agent
      .get('/faults')
      .query({ assignedTo: w.user._id.toString(), withUnseen: 'true', perPage: 10 });
    expect(res.body.hasUnseen).toBe(false);
    expect(res.body.fault[0].unseen).toBe(false);
  });

  test('other-assigned fault uses model A (needs seenSince)', async () => {
    const w1 = await createUser({ role: 'maintenanceWorker', email: 'w1@example.com' });
    const w2 = await createUser({ role: 'maintenanceWorker', email: 'w2@example.com' });
    const agent2 = await loginAs(app, w2);
    const fault = await seedFault({
      assignedMaintainers: [w1.user._id],
      statusFault: 'In progress',
    });

    // No seenSince → model A cannot flag it (safe default: seen).
    let res = await agent2.get('/faults').query({ withUnseen: 'true', perPage: 10 });
    let card = res.body.fault.find((f) => f._id === fault._id.toString());
    expect(card.unseen).toBe(false);

    // A seenSince before the fault's updatedAt → unseen.
    res = await agent2
      .get('/faults')
      .query({ withUnseen: 'true', seenSince: '2000-01-01T00:00:00.000Z', perPage: 10 });
    card = res.body.fault.find((f) => f._id === fault._id.toString());
    expect(card.unseen).toBe(true);
    expect(res.body.hasUnseen).toBe(true);
  });

  test('list-seen advances the timestamp and clears model A', async () => {
    const w1 = await createUser({ role: 'maintenanceWorker', email: 'a1@example.com' });
    const w2 = await createUser({ role: 'maintenanceWorker', email: 'a2@example.com' });
    const agent2 = await loginAs(app, w2);
    await seedFault({ assignedMaintainers: [w1.user._id], statusFault: 'In progress' });

    let seen = await agent2.get('/faults/list-seen');
    expect(seen.status).toBe(200);
    expect(seen.body).toEqual({});

    const patch = await agent2.patch('/faults/list-seen').send({ key: 'worker_active' });
    expect(patch.status).toBe(204);

    seen = await agent2.get('/faults/list-seen');
    expect(seen.body.worker_active).toBeTruthy();

    const res = await agent2
      .get('/faults')
      .query({ withUnseen: 'true', seenSince: seen.body.worker_active, perPage: 10 });
    expect(res.body.hasUnseen).toBe(false);
  });

  test('completed fault is model A even when assigned to me', async () => {
    const w = await createUser({ role: 'maintenanceWorker', email: 'done@example.com' });
    const agent = await loginAs(app, w);
    await seedFault({ assignedMaintainers: [w.user._id], statusFault: 'Completed' });

    // Mine + completed → forced model A → no seenSince → not unseen.
    const res = await agent.get('/faults').query({
      assignedTo: w.user._id.toString(),
      statusFault: 'Completed',
      withUnseen: 'true',
      perPage: 10,
    });
    expect(res.body.hasUnseen).toBe(false);
    expect(res.body.fault[0].unseen).toBe(false);
  });

  test('invalid list-seen key is rejected', async () => {
    const w = await createUser({ role: 'maintenanceWorker', email: 'bad@example.com' });
    const agent = await loginAs(app, w);
    const res = await agent.patch('/faults/list-seen').send({ key: 'worker.bogus' });
    expect(res.status).toBe(400);
  });
});
