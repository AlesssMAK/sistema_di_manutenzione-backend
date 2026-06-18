import { describe, test, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { createPlant, createPlantPart, createUser } from './helpers/fixtures.js';
import { loginAs } from './helpers/auth.js';
import { PlantPart } from '../src/models/part.js';
import { Plant } from '../src/models/plant.js';

describe('plant parts', () => {
  let app;
  let adminAgent;

  beforeAll(() => {
    app = createTestApp();
  });

  const getAdminAgent = async () => {
    const created = await createUser({ role: 'admin' });
    return loginAs(app, created);
  };

  describe('compound unique {plantId, codePlantPart}', () => {
    test('same code can be reused across different plants', async () => {
      const plantA = await createPlant({ code: 'PL-A' });
      const plantB = await createPlant({ code: 'PL-B' });
      adminAgent = await getAdminAgent();

      const a = await adminAgent
        .post('/plants/parts')
        .send({
          plantId: plantA._id.toString(),
          parts: [{ namePlantPart: 'Motor', codePlantPart: 'MOT-01' }],
        });
      expect(a.status).toBe(201);

      const b = await adminAgent
        .post('/plants/parts')
        .send({
          plantId: plantB._id.toString(),
          parts: [{ namePlantPart: 'Motor', codePlantPart: 'MOT-01' }],
        });
      expect(b.status).toBe(201);

      const all = await PlantPart.find({ codePlantPart: 'MOT-01' });
      expect(all).toHaveLength(2);
    });

    test('duplicate code within the same plant returns 409', async () => {
      const plant = await createPlant();
      await createPlantPart(plant, { codePlantPart: 'DUP-01' });
      adminAgent = await getAdminAgent();

      const res = await adminAgent
        .post('/plants/parts')
        .send({
          plantId: plant._id.toString(),
          parts: [{ namePlantPart: 'Other', codePlantPart: 'DUP-01' }],
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/DUP-01/);
    });

    test('DB-level compound index rejects a raw duplicate insert', async () => {
      // Direct model write to prove the index is on the database,
      // not just app-level. createIndexes() must run before the
      // first conflicting insert.
      const plant = await createPlant();
      await PlantPart.createIndexes();
      await PlantPart.create({
        plantId: plant._id,
        namePlantPart: 'First',
        codePlantPart: 'IDX-01',
      });

      await expect(
        PlantPart.create({
          plantId: plant._id,
          namePlantPart: 'Second',
          codePlantPart: 'IDX-01',
        }),
      ).rejects.toThrow(/duplicate key/i);
    });
  });

  describe('soft delete', () => {
    test('DELETE /plants/:plantId/parts/:partId flips status to deactivated, keeps doc', async () => {
      const plant = await createPlant();
      const part = await createPlantPart(plant);
      adminAgent = await getAdminAgent();

      const res = await adminAgent.delete(
        `/plants/${plant._id}/parts/${part._id}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deactivated/i);

      const reloaded = await PlantPart.findById(part._id);
      expect(reloaded).not.toBeNull();
      expect(reloaded.status).toBe('deactivated');
    });

    test('re-deleting an already deactivated part is a no-op 200', async () => {
      const plant = await createPlant();
      const part = await createPlantPart(plant, { status: 'deactivated' });
      adminAgent = await getAdminAgent();

      const res = await adminAgent.delete(
        `/plants/${plant._id}/parts/${part._id}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/already/i);
    });

    test('DELETE /plants/:plantId soft-deletes the plant and does NOT cascade to parts', async () => {
      const plant = await createPlant();
      const part = await createPlantPart(plant);
      adminAgent = await getAdminAgent();

      const res = await adminAgent.delete(`/plants/${plant._id}`);
      expect(res.status).toBe(200);

      const plantReloaded = await Plant.findById(plant._id);
      const partReloaded = await PlantPart.findById(part._id);

      expect(plantReloaded.status).toBe('deactivated');
      // The part keeps its own status — Phase 9 removed the cascade
      // because a single click on Elimina used to silently obliterate
      // every historical Fault.partId reference under that plant.
      expect(partReloaded.status).toBe('active');
    });
  });

  describe('non-admin access', () => {
    test('manager cannot create parts (403)', async () => {
      const plant = await createPlant();
      const created = await createUser({ role: 'manager' });
      const agent = await loginAs(app, created);

      const res = await agent
        .post('/plants/parts')
        .send({
          plantId: plant._id.toString(),
          parts: [{ namePlantPart: 'X', codePlantPart: 'X-01' }],
        });

      expect(res.status).toBe(403);
    });
  });
});
