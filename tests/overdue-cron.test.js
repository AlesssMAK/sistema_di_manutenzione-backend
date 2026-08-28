import { describe, test, expect } from 'vitest';
import { createPlant, createPlantPart, createUser } from './helpers/fixtures.js';
import { Fault } from '../src/models/fault.js';
import { runOverdueScan } from '../src/cron/overdueJob.js';

const makeFault = async ({ statusFault, deadline, suffix }) => {
  const plant = await createPlant();
  const part = await createPlantPart(plant);
  const op = await createUser({ role: 'operator' });
  return Fault.create({
    faultId: `SEG-2026-06-${suffix}`,
    userId: op.user._id,
    nameOperator: op.user.fullName,
    dataCreated: new Date().toISOString().slice(0, 10),
    timeCreated: '09:00',
    plantId: plant._id,
    partId: part._id,
    typeFault: 'Production',
    comment: 'overdue cron test fault',
    statusFault,
    deadline,
  });
};

describe('overdue cron scan', () => {
  test('only Created faults are escalated; in-work ones are left alone', async () => {
    const created = await makeFault({
      statusFault: 'Created',
      deadline: '2000-01-01',
      suffix: '800',
    });
    const suspended = await makeFault({
      statusFault: 'Suspended',
      deadline: '2000-01-01',
      suffix: '801',
    });
    const inProgress = await makeFault({
      statusFault: 'In progress',
      deadline: '2000-01-01',
      suffix: '802',
    });

    await runOverdueScan();

    const c = await Fault.findById(created._id);
    const s = await Fault.findById(suspended._id);
    const i = await Fault.findById(inProgress._id);
    // Stalled, not-yet-picked-up work escalates.
    expect(c.statusFault).toBe('Overdue');
    // A pause is a human decision — leave it alone.
    expect(s.statusFault).toBe('Suspended');
    // A fault a technician is actively working stays In progress (so it
    // never turns claimable again under them); lateness is shown by the
    // red deadline highlighting instead.
    expect(i.statusFault).toBe('In progress');
  });
});
