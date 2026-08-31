import { describe, test, expect, beforeAll } from 'vitest';
import { createTestApp } from './helpers/app.js';
import { createPlant, createPlantPart, createUser } from './helpers/fixtures.js';
import { loginAs } from './helpers/auth.js';
import { Fault } from '../src/models/fault.js';

const MIN = 60 * 1000;

const setupAssignedFault = async (app) => {
  const plant = await createPlant();
  const part = await createPlantPart(plant);
  const op = await createUser({ role: 'operator' });
  const worker = await createUser({
    role: 'maintenanceWorker',
    email: `w-${Date.now()}@example.com`,
  });
  const agent = await loginAs(app, worker);
  const fault = await Fault.create({
    faultId: `SEG-2026-06-${Math.floor(Math.random() * 900 + 100)}`,
    userId: op.user._id,
    nameOperator: op.user.fullName,
    dataCreated: new Date().toISOString().slice(0, 10),
    timeCreated: '09:00',
    plantId: plant._id,
    partId: part._id,
    typeFault: 'Production',
    comment: 'worktime test fault',
    statusFault: 'Created',
    assignedMaintainers: [worker.user._id],
  });
  return { agent, fault };
};

// Rewind the running span's start so the controller books `minutes` of
// worked time on the next transition (deterministic, no real waiting).
const bookMinutes = (id, minutes) =>
  Fault.updateOne(
    { _id: id },
    { $set: { workStartedAt: new Date(Date.now() - minutes * MIN) } },
  );

describe('suspend / resume worked-time accounting', () => {
  let app;
  beforeAll(() => {
    app = createTestApp();
  });

  test('worked time sums the pre-suspension and post-resume spans', async () => {
    const { agent, fault } = await setupAssignedFault(app);

    // Claim → In progress.
    const claim = await agent.patch(
      `/maintenance-worker/fault/${fault._id}/claim`,
    );
    expect(claim.status).toBe(200);

    // 10 min worked, then suspend.
    await bookMinutes(fault._id, 10);
    const suspend = await agent
      .patch(`/maintenance-worker/fault/${fault._id}`)
      .send({ statusFault: 'Suspended', suspensionReason: 'waiting for part' });
    expect(suspend.status).toBe(200);
    expect(suspend.body.statusFault).toBe('Suspended');

    // Resume → In progress.
    const resume = await agent
      .patch(`/maintenance-worker/fault/${fault._id}`)
      .send({ statusFault: 'In progress' });
    expect(resume.status).toBe(200);

    // 5 more min, then complete. actualDuration is user-confirmed (schema
    // requires it), but the backend books workedMs from the spans itself —
    // that's what proves the accumulation across the pause.
    await bookMinutes(fault._id, 5);
    const complete = await agent
      .patch(`/maintenance-worker/fault/${fault._id}`)
      .send({ statusFault: 'Completed', actualDuration: 15 });
    expect(complete.status).toBe(200);

    // 10 + 5 = ~15 min of worked time (small tolerance for exec time).
    expect(complete.body.workedMs).toBeGreaterThanOrEqual(14 * MIN);
    expect(complete.body.workedMs).toBeLessThanOrEqual(16 * MIN);
  });

  test('completing with 0 after a pause keeps the pre-pause time (floor)', async () => {
    const { agent, fault } = await setupAssignedFault(app);
    await agent.patch(`/maintenance-worker/fault/${fault._id}/claim`);
    // Work ~20 min, pause, resume.
    await bookMinutes(fault._id, 20);
    await agent
      .patch(`/maintenance-worker/fault/${fault._id}`)
      .send({ statusFault: 'Suspended', suspensionReason: 'pause' });
    await agent
      .patch(`/maintenance-worker/fault/${fault._id}`)
      .send({ statusFault: 'In progress' });

    // Finalize with the picker left at 0 → must not drop to 0; the ~20
    // booked minutes are the floor (and above the 15-min default).
    const res = await agent
      .patch(`/maintenance-worker/fault/${fault._id}`)
      .send({ statusFault: 'Completed', actualDuration: 0 });
    expect(res.status).toBe(200);
    expect(res.body.actualDuration).toBeGreaterThanOrEqual(20);
  });

  test('actualDuration below the already-worked floor is rejected', async () => {
    const { agent, fault } = await setupAssignedFault(app);
    await agent.patch(`/maintenance-worker/fault/${fault._id}/claim`);
    await bookMinutes(fault._id, 10);
    await agent
      .patch(`/maintenance-worker/fault/${fault._id}`)
      .send({ statusFault: 'Suspended', suspensionReason: 'pause' });
    await agent
      .patch(`/maintenance-worker/fault/${fault._id}`)
      .send({ statusFault: 'In progress' });

    // Floor is the ~10 booked minutes; 5 is below it → 400.
    const res = await agent
      .patch(`/maintenance-worker/fault/${fault._id}`)
      .send({ statusFault: 'Completed', actualDuration: 5 });
    expect(res.status).toBe(400);
  });

  test('zero/empty actualDuration defaults to at least 15 minutes', async () => {
    const { agent, fault } = await setupAssignedFault(app);
    await agent.patch(`/maintenance-worker/fault/${fault._id}/claim`);
    // Complete immediately with 0 → no booked time → default 15.
    const res = await agent
      .patch(`/maintenance-worker/fault/${fault._id}`)
      .send({ statusFault: 'Completed', actualDuration: 0 });
    expect(res.status).toBe(200);
    expect(res.body.actualDuration).toBe(15);
  });

  test('each suspension logs date + reason; material note goes to the list', async () => {
    const { agent, fault } = await setupAssignedFault(app);
    await agent.patch(`/maintenance-worker/fault/${fault._id}/claim`);

    // Pause #1.
    await bookMinutes(fault._id, 10);
    await agent.patch(`/maintenance-worker/fault/${fault._id}`).send({
      statusFault: 'Suspended',
      suspensionReason: 'waiting for bearing',
      materialRequest: 'bearing 6204',
    });
    await agent
      .patch(`/maintenance-worker/fault/${fault._id}`)
      .send({ statusFault: 'In progress' });

    // Pause #2.
    await bookMinutes(fault._id, 5);
    const second = await agent
      .patch(`/maintenance-worker/fault/${fault._id}`)
      .send({
        statusFault: 'Suspended',
        suspensionReason: 'shift ended',
        materialRequest: 'grease',
      });

    expect(second.body.suspensions).toHaveLength(2);
    expect(second.body.suspensions[0].reason).toBe('waiting for bearing');
    expect(second.body.suspensions[1].reason).toBe('shift ended');
    expect(second.body.suspensions[0].suspendedAt).toBeTruthy();
    // The material note is NOT on the log entry — it goes to the shared
    // material list (top-level materialRequest), and notes ACCUMULATE
    // (earlier ones are never lost).
    expect(second.body.suspensions[0].materialRequest).toBeUndefined();
    expect(second.body.materialRequest).toContain('bearing 6204');
    expect(second.body.materialRequest).toContain('grease');

    // Finalize with its own material note — must not wipe the log.
    await agent
      .patch(`/maintenance-worker/fault/${fault._id}`)
      .send({ statusFault: 'In progress' });
    const done = await agent
      .patch(`/maintenance-worker/fault/${fault._id}`)
      .send({
        statusFault: 'Completed',
        actualDuration: 30,
        materialRequest: 'final note',
      });
    expect(done.body.suspensions).toHaveLength(2);
    // Completion note appended — earlier suspension notes still present.
    expect(done.body.materialRequest).toContain('bearing 6204');
    expect(done.body.materialRequest).toContain('final note');
  });

  test('a Suspended fault cannot be completed without resuming first', async () => {
    const { agent, fault } = await setupAssignedFault(app);
    await agent.patch(`/maintenance-worker/fault/${fault._id}/claim`);
    await agent
      .patch(`/maintenance-worker/fault/${fault._id}`)
      .send({ statusFault: 'Suspended', suspensionReason: 'on hold' });

    const res = await agent
      .patch(`/maintenance-worker/fault/${fault._id}`)
      .send({ statusFault: 'Completed', actualDuration: 30 });
    expect(res.status).toBe(409);
  });
});

describe('one running work span at a time', () => {
  let app;
  beforeAll(() => {
    app = createTestApp();
  });

  // Two Created faults assigned to the same fresh worker, plus a logged-in
  // agent for them.
  const setupTwoFaults = async () => {
    const plant = await createPlant();
    const part = await createPlantPart(plant);
    const op = await createUser({ role: 'operator' });
    const worker = await createUser({
      role: 'maintenanceWorker',
      email: `w-oaat-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`,
    });
    const agent = await loginAs(app, worker);
    const makeFault = () =>
      Fault.create({
        faultId: `SEG-2026-07-${Math.floor(Math.random() * 900 + 100)}`,
        userId: op.user._id,
        nameOperator: op.user.fullName,
        dataCreated: new Date().toISOString().slice(0, 10),
        timeCreated: '09:00',
        plantId: plant._id,
        partId: part._id,
        typeFault: 'Production',
        comment: 'one-at-a-time test',
        statusFault: 'Created',
        assignedMaintainers: [worker.user._id],
      });
    const a = await makeFault();
    const b = await makeFault();
    return { agent, a, b };
  };

  test('claiming a second fault while one runs is blocked, then allowed once it is finalized', async () => {
    const { agent, a, b } = await setupTwoFaults();

    expect(
      (await agent.patch(`/maintenance-worker/fault/${a._id}/claim`)).status,
    ).toBe(200);

    const blocked = await agent.patch(
      `/maintenance-worker/fault/${b._id}/claim`,
    );
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('ALREADY_WORKING');
    expect(blocked.body.activeFault.faultId).toBe(a.faultId);

    // Finalize A → frees the running span.
    const fin = await agent
      .patch(`/maintenance-worker/fault/${a._id}`)
      .send({ statusFault: 'Completed', actualDuration: 15 });
    expect(fin.status).toBe(200);

    // Now B claims fine.
    expect(
      (await agent.patch(`/maintenance-worker/fault/${b._id}/claim`)).status,
    ).toBe(200);
  });

  test('resuming a suspended fault is blocked while another fault is running', async () => {
    const { agent, a, b } = await setupTwoFaults();

    // Claim A then suspend it (span freed).
    await agent.patch(`/maintenance-worker/fault/${a._id}/claim`);
    await agent
      .patch(`/maintenance-worker/fault/${a._id}`)
      .send({ statusFault: 'Suspended', suspensionReason: 'hold' });

    // Claim B → now the running span.
    expect(
      (await agent.patch(`/maintenance-worker/fault/${b._id}/claim`)).status,
    ).toBe(200);

    // Resuming A is blocked because B is active.
    const resume = await agent
      .patch(`/maintenance-worker/fault/${a._id}`)
      .send({ statusFault: 'In progress' });
    expect(resume.status).toBe(409);
    expect(resume.body.code).toBe('ALREADY_WORKING');
    expect(resume.body.activeFault.faultId).toBe(b.faultId);
  });
});
