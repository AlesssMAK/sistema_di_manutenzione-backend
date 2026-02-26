import { Fault } from '../models/fault.js';
import { Counter } from '../models/counter.js';
import { PartPlant } from '../models/part.js';
import { saveFileToCloudinary } from '../utils/saveFileToCloudinary.js';
import { User } from '../models/user.js';

export const createFault = async (req, res) => {
  try {
    const plantId = req.body.plantId?.trim();
    const partId = req.body.partId?.trim();
    const { typefault, comment } = req.body;

    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: 'Користувач не авторизований' });
    }

    const partExists = await PartPlant.findOne({
      _id: partId,
      plantId: plantId,
    });
    if (!partExists) {
      return res.status(400).json({
        message:
          'Error: Ця деталь (partId) не належить до цієї машини (plantId).',
      });
    }
    let imageUrl = null;
    if (req.file) {
      const cloudinaryResult = await saveFileToCloudinary(
        req.file.buffer,
        'faults',
      );
      imageUrl = cloudinaryResult.secure_url;
    }
    const counter = await Counter.findOneAndUpdate(
      { id: 'fault_id' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );

    const sequenceNumber = counter && counter.seq ? counter.seq : 0;
    const id_fault = `FLT-${sequenceNumber.toString().padStart(3, '0')}`;

    // Реєстрація часу (Італія)
    const now = new Date();
    const dataCreated = now.toLocaleDateString('it-IT', {
      timeZone: 'Europe/Rome',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const timeCreated = now.toLocaleTimeString('it-IT', {
      timeZone: 'Europe/Rome',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const newFault = await Fault.create({
      id_fault,
      userId,
      nameOperator: req.user?.name || 'Unknown Operator', // Защита на случай отсутствия имени
      dataCreated,
      timeCreated,
      plantId,
      partId,
      typefault,
      comment,
      img: imageUrl,
    });

    return res.status(201).json(newFault);
  } catch (error) {
    return res.status(500).json({
      message: 'Помилка при реєстрації несправності',
      error: error.message,
    });
  }
};

export const getAllOperators = async (req, res, next) => {
  try {
    const operators = await User.find({ role: 'operator' }).select('name');
    res.status(200).json({
      status: 'success',
      results: operators.length,
      data: operators,
    });
  } catch (error) {
    next(error);
  }
};
