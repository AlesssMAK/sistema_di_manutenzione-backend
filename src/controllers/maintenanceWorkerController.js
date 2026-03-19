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

export const addFaultByMaintenanceWorker = async (req, res) => {};
