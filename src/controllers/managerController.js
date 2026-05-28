import { Fault } from '../models/fault.js';
import { User } from '../models/user.js';
import mongoose from 'mongoose';
import { emitFaultUpdated, emitToUser } from '../socket/emitters.js';
import { sendAssignmentEmail } from '../services/email/index.js';
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
