import { Fault } from '../models/fault.js';
import { User } from '../models/user.js';
import mongoose from 'mongoose';

export const addFault = async (req, res) => {
  try {
    const {
      faultId,
      priority,
      assignedMaintainers,
      plannedDate,
      plannedTime,
      deadline,
      estimatedDuration,
      managerComment,
    } = req.body;

    const managerId = req.user?._id;
    const managerName = req.user?.name || 'Менеджер';

    const maintainerObjectIds = assignedMaintainers.map((id) =>
      mongoose.Types.ObjectId.createFromHexString(id.trim()),
    );
    const overlappingFault = await Fault.findOne({
      _id: { $ne: faultId }, // Не считаем текущую задачу
      plannedDate: plannedDate,
      plannedTime: plannedTime,
      assignedMaintainers: { $in: maintainerObjectIds }, // Проверка: есть ли хоть один общий ID
    });

    if (overlappingFault) {
      return res.status(409).json({
        message: `Один із майстрів уже зайнятий на цей час (${plannedDate} ${plannedTime})`,
      });
    }

    const workers = await User.find({
      _id: { $in: assignedMaintainers },
      role: 'maintenanceWorker',
    });

    if (workers.length !== assignedMaintainers.length) {
      return res.status(400).json({
        message: 'Один або кілька вибраних користівачів не є монтерами',
      });
    }

    const fault = await Fault.findById(faultId);

    if (!fault) {
      return res.status(404).json({ message: 'Несправність не знайдена' });
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

    await fault.populate('assignedMaintainers', 'name');

    return res.status(200).json(fault);
  } catch (error) {
    return res.status(500).json({
      message: 'Помилка при оновленні несправності менеджером',
      error: error.message,
    });
  }
};
