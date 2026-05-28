import { Fault } from '../models/fault.js';
import { User } from '../models/user.js';
import {
  emitFaultStatusChanged,
  emitFaultUpdated,
} from '../socket/emitters.js';
import { logFromRequest } from '../services/auditLog.js';

export const getAllMaintenanceWorker = async (req, res) => {
  const maintenanceWorker = await User.find({
    role: 'maintenanceWorker',
  }).select('fullName');
  res.status(200).json({
    status: 'success',
    results: maintenanceWorker.length,
    data: maintenanceWorker,
  });
};

export const addFaultByMaintenanceWorker = async (req, res) => {
  try {
    const { faultId, statusFault, commentMaintenanceWorker } = req.body;
    const maintenanceWorkerId = req.user?._id;
    const maintenanceWorkerName = req.user?.fullName || 'Maintenance worker';
    const fault = await Fault.findById(faultId);

    if (!fault) {
      return res.status(404).json({ message: 'Fault not found' });
    }

    const previousStatus = fault.statusFault;
    const updateData = {
      statusFault,
      commentMaintenanceWorker,
      maintenanceWorkerId,
    };
    fault.history.push({
      action: 'updated_by_maintenanceWorker',
      userId: maintenanceWorkerId,
      userName: maintenanceWorkerName,
      changes: updateData,
      timestamp: new Date(),
    });

    Object.assign(fault, updateData);

    await fault.save();

    const populatedFault = await Fault.findById(fault._id)
      .populate({ path: 'plantId', select: 'namePlant code' })
      .populate({ path: 'partId', select: 'namePlantPart codePlantPart' })
      .populate({ path: 'assignedMaintainers', select: 'fullName email' });

    const statusChanged = statusFault && statusFault !== previousStatus;
    if (statusChanged) {
      emitFaultStatusChanged(populatedFault._id, {
        from: previousStatus,
        to: statusFault,
        userId: maintenanceWorkerId,
      });
    }
    emitFaultUpdated(populatedFault);

    await logFromRequest(req, {
      action: statusChanged ? 'fault.statusChange' : 'fault.update',
      targetType: 'Fault',
      targetId: populatedFault._id,
      summary: statusChanged
        ? `Status ${previousStatus} → ${statusFault} by maintainer`
        : `Updated fault ${populatedFault.faultId} by maintainer`,
      meta: { statusFault, previousStatus, commentMaintenanceWorker },
    });

    return res.status(200).json(populatedFault);
  } catch (error) {
    return res.status(500).json({
      message: 'Error updating fault by maintenance worker',
      error: error.message,
    });
  }
};
