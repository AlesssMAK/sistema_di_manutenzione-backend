import { Fault } from '../models/fault.js';
import { User } from '../models/user.js';

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

    //перевірка, що виконавець дійсно монтер
    const workers = await User.find({
      _id: { $in: assignedMaintainers },
      role: 'maintenanceWorker',
    });

    if (workers.length !== assignedMaintainers.length) {
      return res.status(400).json({
        message: 'Один або кілька вибраних користівачів не є монтерами',
      });
    }
    const updatedFault = await Fault.findByIdAndUpdate(
      faultId,
      {
        priority,
        assignedMaintainers,
        plannedDate,
        plannedTime,
        deadline,
        estimatedDuration,
        managerComment,
        managerId,
      },
      { new: true },
    ).populate('assignedMaintainers', 'name');

    if (!updatedFault) {
      return res.status(404).json({ message: 'Несправність не знайдена' });
    }

    return res.status(200).json(updatedFault);
  } catch (error) {
    return res.status(500).json({
      message: 'Помилка при оновленні несправності менеджером',
      error: error.message,
    });
  }
};
