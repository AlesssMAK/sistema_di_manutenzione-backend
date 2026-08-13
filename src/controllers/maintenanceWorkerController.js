import createHttpError from 'http-errors';
import { DateTime } from 'luxon';
import { Fault } from '../models/fault.js';
import { User } from '../models/user.js';
import {
  emitFaultStatusChanged,
  emitFaultUpdated,
} from '../socket/emitters.js';
import { sendSuspendedEmail } from '../services/email/index.js';
import { logFromRequest } from '../services/auditLog.js';
import { getSettings } from '../services/systemSettings.js';

const ALLOWED_TRANSITIONS = {
  Created: [], // only via claim
  'In progress': ['Completed', 'Suspended'],
  Suspended: ['In progress', 'Completed'],
  Overdue: ['Completed'], // overdue can still be wrapped up
  Completed: [], // terminal
};

const populateFault = (id) =>
  Fault.findById(id)
    .populate({ path: 'plantId', select: 'namePlant code' })
    .populate({ path: 'partId', select: 'namePlantPart codePlantPart' })
    .populate({ path: 'assignedMaintainers', select: 'fullName email' })
    .populate({ path: 'managerId', select: 'fullName email' });

export const getAllMaintenanceWorker = async (req, res) => {
  const maintenanceWorker = await User.find({
    role: 'maintenanceWorker',
    status: 'active',
  }).select('fullName email');
  res.status(200).json({
    status: 'success',
    results: maintenanceWorker.length,
    data: maintenanceWorker,
  });
};

export const claimFault = async (req, res) => {
  const { faultId } = req.params;
  const userId = req.user?._id;
  const userName = req.user?.fullName || 'Maintenance worker';

  if (!userId) {
    throw createHttpError(401, 'User is not authenticated');
  }

  const original = await Fault.findById(faultId);
  if (!original) {
    throw createHttpError(404, 'Fault not found');
  }

  const claimableStatuses = ['Created', 'Overdue'];
  const previousStatus = original.statusFault;

  // Determine "today" in the system timezone so pool faults (claimed
  // without prior manager planning) get a sensible default plannedDate.
  // Without this, the calendar/slot-grid can't show them on any day.
  const settings = await getSettings();
  const tz = settings?.timezone ?? 'Europe/Rome';
  const nowInTz = DateTime.now().setZone(tz);
  const today = nowInTz.toISODate();
  const currentTime = nowInTz.toFormat('HH:mm');

  const claimSet = {
    statusFault: 'In progress',
    claimedBy: userId,
    claimedAt: new Date(),
    // Start the work-time clock; no prior span yet.
    workStartedAt: new Date(),
    workedMs: 0,
    overtimeNotifiedAt: null,
  };
  if (!original.plannedDate) {
    claimSet.plannedDate = today;
    claimSet.plannedTime = currentTime;
  }

  // Scenario A: technician is in assignedMaintainers
  let updated = await Fault.findOneAndUpdate(
    {
      _id: faultId,
      statusFault: { $in: claimableStatuses },
      assignedMaintainers: userId,
    },
    { $set: claimSet },
    { new: true },
  );

  // Scenario B: fault is in pool (empty assignedMaintainers)
  if (!updated) {
    updated = await Fault.findOneAndUpdate(
      {
        _id: faultId,
        statusFault: { $in: claimableStatuses },
        assignedMaintainers: { $size: 0 },
      },
      {
        $set: claimSet,
        $push: { assignedMaintainers: userId },
      },
      { new: true },
    );
  }

  if (!updated) {
    throw createHttpError(
      409,
      'Fault already claimed or not available for claim',
    );
  }

  updated.history.push({
    action: 'status_change',
    userId,
    userName,
    changes: { from: previousStatus, to: 'In progress', claim: true },
    timestamp: new Date(),
  });
  await updated.save();

  const populated = await populateFault(updated._id);

  emitFaultStatusChanged(populated._id, {
    from: previousStatus,
    to: 'In progress',
    userId,
  });
  emitFaultUpdated(populated);

  await logFromRequest(req, {
    action: 'fault.statusChange',
    targetType: 'Fault',
    targetId: populated._id,
    summary: `Claimed fault ${populated.faultId}: ${previousStatus} → In progress`,
    meta: { claimedBy: String(userId), from: previousStatus },
  });

  return res.status(200).json(populated);
};

// ---------- GET /maintenance-worker/tab-counts ----------
// Unseen-count badges for the worker board. "New" = the fault's relevant
// timestamp is later than the tab's lastSeen (persisted per user).
const SEEN_TABS = ['active', 'overdue', 'completed', 'pool'];

export const getMaintenanceTabCounts = async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId).select('maintenanceSeen').lean();
  const seen = user?.maintenanceSeen ?? {};
  const since = (d) => (d ? new Date(d) : new Date(0));

  const [active, overdue, completed, pool] = await Promise.all([
    Fault.countDocuments({
      assignedMaintainers: userId,
      statusFault: { $in: ['Created', 'In progress', 'Suspended'] },
      updatedAt: { $gt: since(seen.active) },
    }),
    Fault.countDocuments({
      assignedMaintainers: userId,
      statusFault: 'Overdue',
      updatedAt: { $gt: since(seen.overdue) },
    }),
    Fault.countDocuments({
      assignedMaintainers: userId,
      statusFault: 'Completed',
      updatedAt: { $gt: since(seen.completed) },
    }),
    // Pool = unassigned faults still up for grabs; "new" by creation time.
    Fault.countDocuments({
      assignedMaintainers: { $size: 0 },
      statusFault: { $in: ['Created', 'Overdue'] },
      createdAt: { $gt: since(seen.pool) },
    }),
  ]);

  return res.status(200).json({ active, overdue, completed, pool });
};

// ---------- PATCH /maintenance-worker/seen ----------
export const markMaintenanceTabSeen = async (req, res) => {
  const userId = req.user._id;
  const { tab } = req.body;
  if (!SEEN_TABS.includes(tab)) {
    throw createHttpError(400, 'Invalid tab');
  }
  await User.updateOne(
    { _id: userId },
    { $set: { [`maintenanceSeen.${tab}`]: new Date() } },
  );
  return res.status(204).end();
};

export const addFaultByMaintenanceWorker = async (req, res) => {
  const { faultId } = req.params;
  const {
    statusFault,
    commentMaintenanceWorker,
    actualDuration,
    suspensionReason,
    materialRequest,
  } = req.body;

  const userId = req.user?._id;
  const userName = req.user?.fullName || 'Maintenance worker';
  const userRole = req.user?.role;

  if (!userId) {
    throw createHttpError(401, 'User is not authenticated');
  }

  const fault = await Fault.findById(faultId);
  if (!fault) {
    throw createHttpError(404, 'Fault not found');
  }

  // Authorization: must be assigned (admin bypass)
  const isAdmin = userRole === 'admin';
  const isAssigned = fault.assignedMaintainers
    .map(String)
    .includes(String(userId));
  if (!isAdmin && !isAssigned) {
    throw createHttpError(403, 'You are not assigned to this fault');
  }

  const previousStatus = fault.statusFault;
  const statusChanged = statusFault !== previousStatus;

  // State machine check
  if (statusChanged) {
    const allowed = ALLOWED_TRANSITIONS[previousStatus] ?? [];
    if (!allowed.includes(statusFault)) {
      throw createHttpError(
        409,
        `Invalid status transition: ${previousStatus} → ${statusFault}`,
      );
    }
  }

  const now = new Date();
  // Effective start of the currently-running work span; falls back to
  // claimedAt for faults claimed before work-time tracking existed.
  const runningStart =
    fault.workStartedAt ??
    (previousStatus === 'In progress' ? fault.claimedAt : null);
  const runningMs = runningStart
    ? Math.max(0, now.getTime() - new Date(runningStart).getTime())
    : 0;

  const updateData = { statusFault };
  if (commentMaintenanceWorker !== undefined) {
    updateData.commentMaintenanceWorker = commentMaintenanceWorker;
  }

  if (statusFault === 'Completed') {
    const finalMs = (fault.workedMs ?? 0) + runningMs;
    updateData.workedMs = finalMs;
    updateData.workStartedAt = null;
    updateData.completedAt = now;
    // Auto-computed default in minutes (min 1). The field is editable on
    // the client, so an explicit value from the technician wins.
    const computed = Math.max(1, Math.round(finalMs / 60000));
    updateData.actualDuration =
      actualDuration != null && actualDuration !== ''
        ? actualDuration
        : computed;
  } else if (statusFault === 'Suspended') {
    updateData.suspensionReason = suspensionReason;
    // Close the running span and pause the clock.
    updateData.workedMs = (fault.workedMs ?? 0) + runningMs;
    updateData.workStartedAt = null;
  } else if (statusFault === 'In progress' && previousStatus === 'Suspended') {
    // Resume — restart the clock without touching accumulated time, and
    // re-arm the overtime alert for the new span.
    updateData.workStartedAt = now;
    updateData.overtimeNotifiedAt = null;
  }
  // Material used/needed is captured on both completion and suspension,
  // so persist it whenever the client sends it rather than gating it on
  // the Suspended branch.
  if (materialRequest !== undefined) {
    updateData.materialRequest = materialRequest;
  }

  fault.history.push({
    action: statusChanged
      ? 'status_change'
      : 'updated_by_maintenanceWorker',
    userId,
    userName,
    changes: updateData,
    timestamp: new Date(),
  });
  Object.assign(fault, updateData);
  await fault.save();

  const populated = await populateFault(fault._id);

  if (statusChanged) {
    emitFaultStatusChanged(populated._id, {
      from: previousStatus,
      to: statusFault,
      userId,
    });
  }
  emitFaultUpdated(populated);

  await logFromRequest(req, {
    action: statusChanged ? 'fault.statusChange' : 'fault.update',
    targetType: 'Fault',
    targetId: populated._id,
    summary: statusChanged
      ? `Status ${previousStatus} → ${statusFault} by maintainer`
      : `Updated fault ${populated.faultId} by maintainer`,
    meta: {
      statusFault,
      previousStatus,
      ...(actualDuration !== undefined && { actualDuration }),
      ...(suspensionReason !== undefined && { suspensionReason }),
    },
  });

  // Async email on Suspended
  if (statusFault === 'Suspended' && populated.managerId) {
    setImmediate(() => {
      sendSuspendedEmail(populated, populated.managerId, req.user).catch(
        (err) =>
          console.error('[email] post-suspend dispatch failed', err.message),
      );
    });
  }

  return res.status(200).json(populated);
};
