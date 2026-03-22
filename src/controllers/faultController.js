import createHttpError from 'http-errors';
import { Fault } from '../models/fault.js';
import { Plant } from '../models/plant.js';
import { PartPlant } from '../models/part.js';
import { saveFileToCloudinary } from '../utils/saveFileToCloudinary.js';
import mongoose from 'mongoose';

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

  await mongoose.connection
    .collection('original_faults')
    .insertOne(newFault.toObject());

  return res.status(201).json(populatedFault);
};

export const getAllFault = async (req, res) => {
  const {
    faultId,
    nameOperator,
    priority,
    plant,
    partPlant,
    typefault,
    dataCreated,
    timeCreated,
    deadline,
    sort = 'desc',
    sortBy = 'dataCreated',
    sortOrder = 'asc',
    page = 1,
    perPage = 2,
  } = req.query;

  const query = {};

  //фільтрація
  if (deadline) query.deadline = deadline;
  if (priority) query.priority = priority;
  if (faultId) query.faultId = faultId;
  if (nameOperator) query.nameOperator = nameOperator;
  if (typefault) query.typefault = typefault;
  if (dataCreated) query.dataCreated = dataCreated;
  if (timeCreated) query.timeCreated = timeCreated;

  if (plant) {
    const plants = await Plant.find({
      $or: [
        { namePlant: new RegExp(plant, 'i') },
        { code: new RegExp(plant, 'i') },
      ],
    });

    const plantIds = plants.map((p) => p._id);
    query.plantId = { $in: plantIds };
  }

  if (partPlant) {
    const parts = await PartPlant.find({
      $or: [
        { namePartPlant: new RegExp(partPlant, 'i') },
        { codePartPlant: new RegExp(partPlant, 'i') },
      ],
    });

    const partIds = parts.map((p) => p._id);
    query.partId = { $in: partIds };
  }

  const sortOption = sort === 'asc' ? 1 : -1;
  const skip = (page - 1) * perPage;

  const [totalFault, fault] = await Promise.all([
    Fault.countDocuments(query),
    Fault.find(query)
      .populate({ path: 'plantId', select: 'namePlant code' })
      .populate({ path: 'partId', select: 'namePartPlant codePartPlant' })
      .sort({ createdAt: sortOption })
      .skip(skip)
      .limit(perPage)
      .sort({ [sortBy]: sortOrder })
      .lean(),
  ]);

  const totalPage = Math.ceil(totalFault / perPage);

  res.status(200).json({
    page,
    perPage,
    totalFault,
    totalPage,
    fault,
  });
};

export const getFaultById = async (req, res) => {
  const { faultId } = req.params;

  const fault = await Fault.findById(faultId)
    .populate({ path: 'plantId', select: 'namePlant code' })
    .populate({ path: 'partId', select: 'namePartPlant codePartPlant' });

  if (!fault) {
    throw createHttpError(404, 'Fault not found');
  }

  res.status(200).json(fault);
};
