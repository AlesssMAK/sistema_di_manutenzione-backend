import createHttpError from 'http-errors';
import { DateTime } from 'luxon';
import { Fault } from '../models/fault.js';
import { FaultView } from '../models/faultView.js';
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
  // Must be resumed before completing — the worker Riprendi's first, which
  // also guarantees the post-resume span is added to the worked time.
  Suspended: ['In progress'],
  Overdue: ['Completed'], // overdue can still be wrapped up
  Completed: [], // terminal
};

const populateFault = (id) =>
  Fault.findById(id)
    .populate({ path: 'plantId', select: 'namePlant code' })
    .populate({ path: 'partId', select: 'namePlantPart codePlantPart' })
    .populate({ path: 'assignedMaintainers', select: 'fullName email' })
    .populate({ path: 'managerId', select: 'fullName email' });

// A technician may only have ONE running work span at a time. Returns the
// other fault they are actively working on (workStartedAt set), if any, so
// the caller can block the new start and tell the client which fault to
// finalize / suspend first.
const findOtherActiveWorkFault = (userId, excludeId) =>
  Fault.findOne({
    _id: { $ne: excludeId },
    assignedMaintainers: userId,
    workStartedAt: { $ne: null },
  })
    .select(
      'faultId statusFault plannedDate plannedTime plantId partId workedMs workStartedAt',
    )
    .populate({ path: 'plantId', select: 'namePlant code' })
    .populate({ path: 'partId', select: 'namePlantPart codePlantPart' })
    .lean();

// Structured 409 so the front-end can show the "già al lavoro" modal
// (finalize / suspend / continue) instead of a generic error toast.
const alreadyWorkingResponse = (res, activeFault) =>
  res.status(409).json({
    code: 'ALREADY_WORKING',
    message: 'You are already working on another fault',
    activeFault,
  });

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

  // One running work span at a time — block the claim if the technician is
  // already working on another fault.
  const activeFault = await findOtherActiveWorkFault(userId, faultId);
  if (activeFault) {
    return alreadyWorkingResponse(res, activeFault);
  }

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

  // Claiming counts as "seen" — clear this fault's unseen dot for the
  // claimer (mirrors the detail-open mark-seen).
  await FaultView.updateOne(
    { user: userId, fault: updated._id },
    { $set: { seenAt: new Date() } },
    { upsert: true },
  );

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

  // Resuming a suspended fault starts a new work span — block it if the
  // technician is already running another fault (one at a time). Finalize /
  // suspend of the CURRENT fault stay allowed, since those free the span.
  if (statusFault === 'In progress' && previousStatus === 'Suspended') {
    const activeFault = await findOtherActiveWorkFault(userId, faultId);
    if (activeFault) {
      return alreadyWorkingResponse(res, activeFault);
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
    // Floor = time already booked BEFORE this completion (finished spans,
    // i.e. everything up to the last suspension). The technician-stated
    // duration is editable but can never dip below what was actually
    // worked, and empty/zero falls back to a sensible 15-minute default.
    const bookedMin = Math.round((fault.workedMs ?? 0) / 60000);
    let stated =
      actualDuration != null && actualDuration !== ''
        ? Number(actualDuration)
        : 0;
    if (stated > 0 && stated < bookedMin) {
      throw createHttpError(
        400,
        `Actual duration cannot be less than the time already worked (${bookedMin} min)`,
      );
    }
    if (stated <= 0) stated = Math.max(15, bookedMin);
    updateData.actualDuration = stated;
  } else if (statusFault === 'Suspended') {
    // Latest reason drives the current-suspension card callout.
    updateData.suspensionReason = suspensionReason;
    // Close the running span and pause the clock.
    updateData.workedMs = (fault.workedMs ?? 0) + runningMs;
    updateData.workStartedAt = null;
    // Append to the suspension log — a fault can be paused repeatedly and
    // each pause keeps its own date + reason. The material note is NOT
    // stored here; it goes to the shared material list (see below). Guard
    // the array for faults created before this field existed.
    if (!Array.isArray(fault.suspensions)) fault.suspensions = [];
    fault.suspensions.push({
      suspendedAt: now,
      reason: suspensionReason ?? '',
    });
  } else if (statusFault === 'In progress' && previousStatus === 'Suspended') {
    // Resume — restart the clock without touching accumulated time, and
    // re-arm the overtime alert for the new span.
    updateData.workStartedAt = now;
    updateData.overtimeNotifiedAt = null;
  }

  // Material note lands in the shared material list (fault.materialRequest,
  // shown in the materials panel) whether it was sent on suspend or on
  // completion. It APPENDS (never overwrites) so notes from earlier pauses
  // are not lost — each non-empty note becomes its own line.
  if (typeof materialRequest === 'string' && materialRequest.trim() !== '') {
    updateData.materialRequest = [fault.materialRequest, materialRequest.trim()]
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean)
      .join('\n');
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
