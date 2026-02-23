import { Fault } from '../models/fault.js';
import { Counter } from '../models/counter.js';
import { PartPlant } from '../models/part.js';

export const createFault = async (req, res) => {
  try {
    const plantId = req.body.plantId?.trim();
    const partId = req.body.partId?.trim();
    const { typefault, comment, img } = req.body;

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
      // nameOperator: req.user?.name || 'Unknown Operator', // Защита на случай отсутствия имени
      dataCreated,
      timeCreated,
      plantId,
      partId,
      typefault,
      comment,
      img,
    });

    return res.status(201).json(newFault);
  } catch (error) {
    return res.status(500).json({
      message: 'Помилка при реєстрації несправності',
      error: error.message,
    });
  }
};
