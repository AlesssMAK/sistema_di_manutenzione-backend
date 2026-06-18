import { Fault } from '../models/fault.js';
import { User } from '../models/user.js';
import mongoose from 'mongoose';
import { emitFaultUpdated, emitToUser } from '../socket/emitters.js';
import {
  sendAssignmentEmail,
  sendReassignEmail,
} from '../services/email/index.js';
import { logFromRequest } from '../services/auditLog.js';

export const addFault = async (req, res) => {
  try {
    const {
      faultId: documentId,
      priority,
      assignedMaintainers,
      plannedDate,
      plannedTime,
      deadline,
      estimatedDuration,
      managerComment,
      typeFault,
    } = req.body;

    const managerId = req.user?._id;
    const managerName = req.user?.fullName || 'Manager';

    const maintainerObjectIds = assignedMaintainers.map((id) =>
      mongoose.Types.ObjectId.createFromHexString(id.trim()),
    );
    const overlappingFault = await Fault.findOne({
      _id: { $ne: documentId },
      plannedDate: plannedDate,
      plannedTime: plannedTime,
      assignedMaintainers: { $in: maintainerObjectIds },
    });

    if (overlappingFault) {
      return res.status(409).json({
        message: `One or more maintainers are already busy at this time (${plannedDate} ${plannedTime})`,
      });
    }

    const workers = await User.find({
      _id: { $in: assignedMaintainers },
      role: 'maintenanceWorker',
    });

    if (workers.length !== assignedMaintainers.length) {
      return res.status(400).json({
        message: 'One or more selected users are not maintenance workers',
      });
    }

    const fault = await Fault.findById(documentId);

    if (!fault) {
      return res.status(404).json({ message: 'Fault not found' });
    }

    const updateData = {
      priority,
      assignedMaintainers,
      plannedDate,
      plannedTime,
      deadline,
      estimatedDuration,
      managerComment,
      managerId,
      typeFault,
    };

    fault.history.push({
      action: 'updated_by_manager',
      userId: managerId,
      userName: managerName,
      changes: updateData,
      timestamp: new Date(),
    });

    Object.assign(fault, updateData);

    await fault.save();

    const populatedFault = await Fault.findById(fault._id)
      .populate({ path: 'plantId', select: 'namePlant code' })
      .populate({ path: 'partId', select: 'namePlantPart codePlantPart' })
      .populate({ path: 'assignedMaintainers', select: 'fullName email' });

    emitFaultUpdated(populatedFault);
    for (const maintainer of populatedFault.assignedMaintainers ?? []) {
      emitToUser(maintainer._id, 'fault:updated', populatedFault);
    }

    await logFromRequest(req, {
      action: 'fault.assign',
      targetType: 'Fault',
      targetId: populatedFault._id,
      summary: `Assigned fault ${populatedFault.faultId} to ${workers.length} maintainer(s)`,
      meta: {
        priority,
        plannedDate,
        plannedTime,
        deadline,
        assignedMaintainers,
      },
    });

    setImmediate(() => {
      sendAssignmentEmail(
        populatedFault,
        populatedFault.assignedMaintainers ?? [],
      ).catch((err) =>
        console.error('[email] post-assign dispatch failed', err.message),
      );
    });

    return res.status(200).json(populatedFault);
  } catch (error) {
    return res.status(500).json({
      message: 'Error updating fault by manager',
      error: error.message,
    });
  }
};

/**
 * PATCH /manager/fault/:faultId/reassign
 *
 * Replaces the fault's assignedMaintainers with a fresh list. Diffs
 * the new list against the previous one so we can:
 *   - send a "reassigned" notice to the workers we removed
 *   - send the existing assignment email to the workers we added
 *   - emit fault:updated to everyone (managers + new assignees)
 *
 * statusFault is intentionally left alone: per the manager workflow
 * decision (2026-06-15), if a fault was In progress we don't reset
 * to Created, and if it's now empty (back to pool) we don't force a
 * status either — the manager can do that separately if needed.
 */
export const reassignFault = async (req, res) => {
  const { faultId } = req.params;
  const { assignedMaintainers: nextIds = [] } = req.body;

  const fault = await Fault.findById(faultId);
  if (!fault) {
    return res.status(404).json({ message: 'Fault not found' });
  }

  // Existing list may be raw ids OR populated objects depending on
  // when the document was last read — normalize to id strings.
  const previousIds = (fault.assignedMaintainers ?? []).map((m) =>
    typeof m === 'string' ? m : String(m._id ?? m),
  );
  const nextSet = new Set(nextIds.map(String));
  const prevSet = new Set(previousIds.map(String));

  const removedIds = [...prevSet].filter((id) => !nextSet.has(id));
  const addedIds = [...nextSet].filter((id) => !prevSet.has(id));

  if (removedIds.length === 0 && addedIds.length === 0) {
    return res
      .status(400)
      .json({ message: 'Assignee list unchanged — nothing to reassign' });
  }

  // Validate that every newcomer actually exists and has the right role.
  if (addedIds.length > 0) {
    const newWorkers = await User.find({
      _id: { $in: addedIds },
      role: 'maintenanceWorker',
    });
    if (newWorkers.length !== addedIds.length) {
      return res.status(400).json({
        message: 'One or more new assignees are not maintenance workers',
      });
    }
  }

  fault.assignedMaintainers = nextIds.map((id) =>
    mongoose.Types.ObjectId.createFromHexString(id.trim()),
  );

  const managerId = req.user?._id;
  const managerName = req.user?.fullName || 'Manager';
  fault.history.push({
    action: 'reassigned_by_manager',
    userId: managerId,
    userName: managerName,
    changes: { added: addedIds, removed: removedIds },
    timestamp: new Date(),
  });

  await fault.save();

  const populatedFault = await Fault.findById(fault._id)
    .populate({ path: 'plantId', select: 'namePlant code' })
    .populate({ path: 'partId', select: 'namePlantPart codePlantPart' })
    .populate({ path: 'assignedMaintainers', select: 'fullName email' });

  emitFaultUpdated(populatedFault);
  for (const maintainer of populatedFault.assignedMaintainers ?? []) {
    emitToUser(maintainer._id, 'fault:updated', populatedFault);
  }

  await logFromRequest(req, {
    action: 'fault.reassign',
    targetType: 'Fault',
    targetId: populatedFault._id,
    summary: `Reassigned fault ${populatedFault.faultId} (added ${addedIds.length}, removed ${removedIds.length})`,
    meta: { added: addedIds, removed: removedIds },
  });

  // Notify the workers we just dropped + the workers we just added.
  setImmediate(() => {
    (async () => {
      if (removedIds.length > 0) {
        const removed = await User.find({ _id: { $in: removedIds } }).select(
          'fullName email',
        );
        await sendReassignEmail(populatedFault, removed);
      }
      if (addedIds.length > 0) {
        const added = (populatedFault.assignedMaintainers ?? []).filter((m) =>
          addedIds.includes(String(m._id)),
        );
        await sendAssignmentEmail(populatedFault, added);
      }
    })().catch((err) =>
      console.error('[email] post-reassign dispatch failed', err.message),
    );
  });

  return res.status(200).json(populatedFault);
};

/**
 * POST /manager/fault/:faultId/add-maintainers
 *
 * Append-only counterpart to reassign: extends the existing
 * assignedMaintainers list without dropping anyone. The semantic
 * split matters for UX — "add help" reads very differently from
 * "swap people out", and the audit/history trail benefits from the
 * intent being explicit. Returns 400 if any id is already on the
 * fault (the caller should filter those out client-side).
 */
export const addMaintainers = async (req, res) => {
  const { faultId } = req.params;
  const { additionalMaintainers = [] } = req.body;

  const fault = await Fault.findById(faultId);
  if (!fault) {
    return res.status(404).json({ message: 'Fault not found' });
  }

  const previousIds = (fault.assignedMaintainers ?? []).map((m) =>
    typeof m === 'string' ? m : String(m._id ?? m),
  );
  const prevSet = new Set(previousIds);
  const addedIds = [...new Set(additionalMaintainers.map(String))];

  const duplicates = addedIds.filter((id) => prevSet.has(id));
  if (duplicates.length > 0) {
    return res.status(400).json({
      message: 'One or more maintainers are already assigned to this fault',
      duplicates,
    });
  }

  const newWorkers = await User.find({
    _id: { $in: addedIds },
    role: 'maintenanceWorker',
  });
  if (newWorkers.length !== addedIds.length) {
    return res.status(400).json({
      message: 'One or more selected users are not maintenance workers',
    });
  }

  fault.assignedMaintainers = [
    ...(fault.assignedMaintainers ?? []),
    ...addedIds.map((id) =>
      mongoose.Types.ObjectId.createFromHexString(id.trim()),
    ),
  ];

  const managerId = req.user?._id;
  const managerName = req.user?.fullName || 'Manager';
  fault.history.push({
    action: 'maintainers_added_by_manager',
    userId: managerId,
    userName: managerName,
    changes: { added: addedIds },
    timestamp: new Date(),
  });

  await fault.save();

  const populatedFault = await Fault.findById(fault._id)
    .populate({ path: 'plantId', select: 'namePlant code' })
    .populate({ path: 'partId', select: 'namePlantPart codePlantPart' })
    .populate({ path: 'assignedMaintainers', select: 'fullName email' });

  emitFaultUpdated(populatedFault);
  for (const maintainer of populatedFault.assignedMaintainers ?? []) {
    emitToUser(maintainer._id, 'fault:updated', populatedFault);
  }

  await logFromRequest(req, {
    action: 'fault.maintainersAdded',
    targetType: 'Fault',
    targetId: populatedFault._id,
    summary: `Added ${addedIds.length} maintainer(s) to fault ${populatedFault.faultId}`,
    meta: { added: addedIds },
  });

  setImmediate(() => {
    const added = (populatedFault.assignedMaintainers ?? []).filter((m) =>
      addedIds.includes(String(m._id)),
    );
    sendAssignmentEmail(populatedFault, added).catch((err) =>
      console.error('[email] post-add-maintainers dispatch failed', err.message),
    );
  });

  return res.status(200).json(populatedFault);
};
