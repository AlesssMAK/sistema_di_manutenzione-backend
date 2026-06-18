import { describe, test, expect, beforeAll } from 'vitest';
import { createTestApp } from './helpers/app.js';
import {
  createPlant,
  createPlantPart,
  createUser,
} from './helpers/fixtures.js';
import { loginAs } from './helpers/auth.js';
import { Fault } from '../src/models/fault.js';

// Today + N as 'YYYY-MM-DD'.
const isoDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const baseFault = ({ plantId, partId, suffix }) => ({
  faultId: `SEG-2026-06-${suffix}`,
  dataCreated: isoDate(),
  timeCreated: '09:00',
  plantId,
  partId,
  typeFault: 'Production',
  comment: 'Description of the test fault',
});

describe('fault create + manager flow', () => {
  let app;
  beforeAll(() => {
    app = createTestApp();
  });

  const setupOperator = async () => {
    const plant = await createPlant();
    const part = await createPlantPart(plant);
    const created = await createUser({
      role: 'operator',
      fullName: 'Mario Rossi',
    });
    const agent = await loginAs(app, created);
    return { plant, part, agent, user: created.user };
  };

  describe('POST /faults', () => {
    test('operator creates a fault, gets back the populated doc', async () => {
      const { plant, part, agent } = await setupOperator();
      const res = await agent
        .post('/faults')
        .send(
          baseFault({
            plantId: plant._id.toString(),
            partId: part._id.toString(),
            suffix: '001',
          }),
        );

      expect(res.status).toBe(201);
      expect(res.body.faultId).toBe('SEG-2026-06-001');
      expect(res.body.plantId.namePlant).toBe(plant.namePlant);
      expect(res.body.partId.namePlantPart).toBe(part.namePlantPart);
      expect(res.body.history).toHaveLength(1);
      expect(res.body.history[0].action).toBe('created');
    });

    test('part not belonging to the plant is rejected (400)', async () => {
      const { agent } = await setupOperator();
      const plantA = await createPlant({ code: 'A-1' });
      const plantB = await createPlant({ code: 'B-1' });
      const partOfB = await createPlantPart(plantB);

      const res = await agent
        .post('/faults')
        .send(
          baseFault({
            plantId: plantA._id.toString(),
            partId: partOfB._id.toString(),
            suffix: '002',
          }),
        );

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/does not belong/i);
    });

    test('duplicate faultId is rejected (409)', async () => {
      const { plant, part, agent } = await setupOperator();
      const payload = baseFault({
        plantId: plant._id.toString(),
        partId: part._id.toString(),
        suffix: '003',
      });

      await agent.post('/faults').send(payload).expect(201);
      const res = await agent.post('/faults').send(payload);
      expect(res.status).toBe(409);
    });
  });

  describe('manager planning', () => {
    const seedFault = async () => {
      const { plant, part, agent: opAgent } = await setupOperator();
      const created = await opAgent.post('/faults').send(
        baseFault({
          plantId: plant._id.toString(),
          partId: part._id.toString(),
          suffix: '010',
        }),
      );
      return { fault: created.body, plant, part };
    };

    test('POST /manager/fault sets planning + assignedMaintainers + history', async () => {
      const { fault } = await seedFault();
      const maintainer = (await createUser({ role: 'maintenanceWorker' })).user;
      const managerAgent = await loginAs(
        app,
        await createUser({ role: 'manager' }),
      );

      const res = await managerAgent.post('/manager/fault').send({
        faultId: fault._id,
        priority: 'High',
        assignedMaintainers: [maintainer._id.toString()],
        plannedDate: isoDate(1),
        plannedTime: '10:00',
        deadline: isoDate(3),
        estimatedDuration: 60,
        managerComment: 'urgent',
        typeFault: 'Production',
      });

      expect(res.status).toBe(200);
      expect(res.body.priority).toBe('High');
      expect(res.body.plannedTime).toBe('10:00');
      expect(res.body.assignedMaintainers).toHaveLength(1);
      expect(String(res.body.assignedMaintainers[0]._id)).toBe(
        maintainer._id.toString(),
      );

      const reloaded = await Fault.findById(fault._id);
      const lastHistory = reloaded.history[reloaded.history.length - 1];
      expect(lastHistory.action).toBe('updated_by_manager');
    });

    test('PATCH reassign diffs the list and updates history', async () => {
      const { fault } = await seedFault();
      const m1 = (await createUser({ role: 'maintenanceWorker' })).user;
      const m2 = (await createUser({ role: 'maintenanceWorker' })).user;
      const m3 = (await createUser({ role: 'maintenanceWorker' })).user;
      const managerAgent = await loginAs(
        app,
        await createUser({ role: 'manager' }),
      );

      await managerAgent
        .post('/manager/fault')
        .send({
          faultId: fault._id,
          priority: 'Medium',
          assignedMaintainers: [m1._id.toString(), m2._id.toString()],
          plannedDate: isoDate(1),
          plannedTime: '10:00',
          deadline: isoDate(3),
          estimatedDuration: 60,
          typeFault: 'Production',
        })
        .expect(200);

      // Drop m1, keep m2, add m3.
      const res = await managerAgent
        .patch(`/manager/fault/${fault._id}/reassign`)
        .send({
          assignedMaintainers: [m2._id.toString(), m3._id.toString()],
        });

      expect(res.status).toBe(200);
      const ids = res.body.assignedMaintainers
        .map((m) => String(m._id))
        .sort();
      expect(ids).toEqual([m2._id.toString(), m3._id.toString()].sort());

      const reloaded = await Fault.findById(fault._id);
      const lastHistory = reloaded.history[reloaded.history.length - 1];
      expect(lastHistory.action).toBe('reassigned_by_manager');
      expect(lastHistory.changes.added).toContain(m3._id.toString());
      expect(lastHistory.changes.removed).toContain(m1._id.toString());
    });

    test('PATCH reassign with identical list is rejected (400)', async () => {
      const { fault } = await seedFault();
      const m1 = (await createUser({ role: 'maintenanceWorker' })).user;
      const managerAgent = await loginAs(
        app,
        await createUser({ role: 'manager' }),
      );

      await managerAgent
        .post('/manager/fault')
        .send({
          faultId: fault._id,
          priority: 'Medium',
          assignedMaintainers: [m1._id.toString()],
          plannedDate: isoDate(1),
          plannedTime: '10:00',
          deadline: isoDate(3),
          estimatedDuration: 60,
          typeFault: 'Production',
        })
        .expect(200);

      const res = await managerAgent
        .patch(`/manager/fault/${fault._id}/reassign`)
        .send({ assignedMaintainers: [m1._id.toString()] });

      expect(res.status).toBe(400);
    });

    test('POST add-maintainers appends without dropping anyone', async () => {
      const { fault } = await seedFault();
      const m1 = (await createUser({ role: 'maintenanceWorker' })).user;
      const m2 = (await createUser({ role: 'maintenanceWorker' })).user;
      const managerAgent = await loginAs(
        app,
        await createUser({ role: 'manager' }),
      );

      await managerAgent
        .post('/manager/fault')
        .send({
          faultId: fault._id,
          priority: 'Low',
          assignedMaintainers: [m1._id.toString()],
          plannedDate: isoDate(1),
          plannedTime: '10:00',
          deadline: isoDate(3),
          estimatedDuration: 60,
          typeFault: 'Production',
        })
        .expect(200);

      const res = await managerAgent
        .post(`/manager/fault/${fault._id}/add-maintainers`)
        .send({ additionalMaintainers: [m2._id.toString()] });

      expect(res.status).toBe(200);
      const ids = res.body.assignedMaintainers
        .map((m) => String(m._id))
        .sort();
      expect(ids).toEqual([m1._id.toString(), m2._id.toString()].sort());
    });

    test('add-maintainers rejects ids already on the fault (400)', async () => {
      const { fault } = await seedFault();
      const m1 = (await createUser({ role: 'maintenanceWorker' })).user;
      const managerAgent = await loginAs(
        app,
        await createUser({ role: 'manager' }),
      );

      await managerAgent
        .post('/manager/fault')
        .send({
          faultId: fault._id,
          priority: 'Low',
          assignedMaintainers: [m1._id.toString()],
          plannedDate: isoDate(1),
          plannedTime: '10:00',
          deadline: isoDate(3),
          estimatedDuration: 60,
          typeFault: 'Production',
        })
        .expect(200);

      const res = await managerAgent
        .post(`/manager/fault/${fault._id}/add-maintainers`)
        .send({ additionalMaintainers: [m1._id.toString()] });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already assigned/i);
    });
  });
});
