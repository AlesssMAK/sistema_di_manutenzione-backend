import createHttpError from 'http-errors';
import { Fault } from '../models/fault.js';
import { emitFaultUpdated } from '../socket/emitters.js';
import { logFromRequest } from '../services/auditLog.js';

const populateFault = (id) =>
  Fault.findById(id)
    .populate({ path: 'plantId', select: 'namePlant code' })
    .populate({ path: 'partId', select: 'namePlantPart codePlantPart' })
    .populate({ path: 'assignedMaintainers', select: 'fullName email' })
    .populate({ path: 'managerId', select: 'fullName email' });

/**
 * HSE-only endpoint: add or replace `commentSafety` on a fault.
 * HSE has no other write action on faults (per docx §6.4 "ТІЛЬКИ ПЕРЕГЛЯД"),
 * so the comment is a single field rewritable by HSE/admin.
 */
export const updateFaultBySafety = async (req, res) => {
  const { faultId } = req.params;
  const { commentSafety } = req.body;

  const userId = req.user?._id;
  const userName = req.user?.fullName || 'HSE';

  if (!userId) {
    throw createHttpError(401, 'User is not authenticated');
  }

  const fault = await Fault.findById(faultId);
  if (!fault) {
    throw createHttpError(404, 'Fault not found');
  }

  const previousComment = fault.commentSafety ?? '';

  fault.history.push({
    action: 'updated_by_safety',
    userId,
    userName,
    changes: { commentSafety: { from: previousComment, to: commentSafety } },
    timestamp: new Date(),
  });
  fault.commentSafety = commentSafety;
  await fault.save();

  const populated = await populateFault(fault._id);

  emitFaultUpdated(populated);

  await logFromRequest(req, {
    action: 'fault.update',
    targetType: 'Fault',
    targetId: populated._id,
    summary: `HSE comment updated on fault ${populated.faultId}`,
    meta: { previousLength: previousComment.length, newLength: commentSafety.length },
  });

  return res.status(200).json(populated);
};
