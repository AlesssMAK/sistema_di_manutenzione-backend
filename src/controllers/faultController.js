import createHttpError from 'http-errors';
import { Fault } from '../models/fault.js';
import { Plant } from '../models/plant.js';
import { PartPlant } from '../models/part.js';
import { saveFileToCloudinary } from '../utils/saveFileToCloudinary.js';

export const createFault = async (req, res) => {
  const {
    faultId,
    dataCreated,
    timeCreated,
    plantId,
    partId,
    typefault,
    comment,
  } = req.body;

  const existsId = await Fault.findOne({ faultId });
  if (existsId) {
    throw createHttpError(409, 'This ID already exists');
  }

  const userId = req.user?._id;

  if (!userId) {
    throw createHttpError(401, 'User is not authenticated');
  }

  const plant = await Plant.findById(plantId);
  if (!plant) {
    throw createHttpError(400, 'Plant not found');
  }

  const part = await PartPlant.findById(partId);
  if (!part) {
    throw createHttpError(400, 'Part of plant not found');
  }

  if (String(part.plantId) !== String(plantId)) {
    throw createHttpError(400, 'This part does not belong to this plant');
  }

  let imageUrl = null;
  if (req.file) {
    const cloudinaryResult = await saveFileToCloudinary(
      req.file.buffer,
      'faults',
    );
    imageUrl = cloudinaryResult.secure_url;
  }

  const newFault = await Fault.create({
    faultId,
    userId,
    nameOperator: req.user?.fullName || 'Unknown Operator', // Защита на случай отсутствия имени
    dataCreated,
    timeCreated,
    plantId,
    partId,
    typefault,
    comment,
    img: imageUrl,
    history: [
      {
        action: 'created',
        userId: userId,
        userName: req.user?.name || 'Operator',
        timestamp: new Date(),
      },
    ],
  });

  const populatedFault = await Fault.findById(newFault._id)
    .populate({ path: 'plantId', select: 'namePlant code' })
    .populate({ path: 'partId', select: 'namePartPlant codePartPlant' });

  return res.status(201).json(populatedFault);
};

export const getAllFault = async (req, res) => {};
