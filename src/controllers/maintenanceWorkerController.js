import createHttpError from 'http-errors';
import { Fault } from '../models/fault.js';
import { User } from '../models/user.js';
import {
  emitFaultStatusChanged,
  emitFaultUpdated,
} from '../socket/emitters.js';
import { sendSuspendedEmail } from '../services/email/index.js';
import { logFromRequest } from '../services/auditLog.js';

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

  // Scenario A: technician is in assignedMaintainers
  let updated = await Fault.findOneAndUpdate(
    {
      _id: faultId,
      statusFault: { $in: claimableStatuses },
      assignedMaintainers: userId,
    },
    {
      $set: {
        statusFault: 'In progress',
        claimedBy: userId,
        claimedAt: new Date(),
      },
    },
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
        $set: {
          statusFault: 'In progress',
          claimedBy: userId,
          claimedAt: new Date(),
        },
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

  const updateData = { statusFault };
  if (commentMaintenanceWorker !== undefined) {
    updateData.commentMaintenanceWorker = commentMaintenanceWorker;
  }
  if (statusFault === 'Completed') {
    updateData.actualDuration = actualDuration;
    updateData.completedAt = new Date();
  }
  if (statusFault === 'Suspended') {
    updateData.suspensionReason = suspensionReason;
    if (materialRequest !== undefined) {
      updateData.materialRequest = materialRequest;
    }
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
