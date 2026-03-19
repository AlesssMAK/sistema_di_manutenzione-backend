import { Fault } from '../models/fault.js';
import { User } from '../models/user.js';

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
    const { faultId, statusfault, commentMaintenanceWorker } = req.body;
    const maintenanceWorkerId = req.user?._id;
    const maintenanceWorkerName = req.user?.name || 'Монтер';
    const fault = await Fault.findById(faultId);

    if (!fault) {
      return res.status(404).json({ message: 'Несправність не знайдена' });
    }

    const updateData = {
      faultId,
      statusfault,
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
    return res.status(200).json(fault);
  } catch (error) {
    return res.status(500).json({
      message: 'Помилка при оновленні несправності монтером',
      error: error.message,
    });
  }
};
