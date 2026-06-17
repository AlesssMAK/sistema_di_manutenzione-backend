import createHttpError from 'http-errors';
import mongoose from 'mongoose';
import { Fault } from '../models/fault.js';
import { Plant } from '../models/plant.js';
import { PlantPart } from '../models/part.js';
import { User } from '../models/user.js';
import { saveFileToCloudinary } from '../utils/saveFileToCloudinary.js';
import { emitFaultCreated } from '../socket/emitters.js';
import {
  sendNewFaultEmail,
  sendSicurezzaHseEmail,
} from '../services/email/index.js';
import { logFromRequest } from '../services/auditLog.js';

export const createFault = async (req, res) => {
  const {
    faultId,
    dataCreated,
    timeCreated,
    plantId,
    partId,
    typeFault,
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

  const part = await PlantPart.findById(partId);
  if (!part) {
    throw createHttpError(400, 'Part of plant not found');
  }

  if (String(part.plantId) !== String(plantId)) {
    throw createHttpError(400, 'This part does not belong to this plant');
  }

  let imageUrls = [];

  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const cloudinaryResult = await saveFileToCloudinary(
        file.buffer,
        'faults',
      );
      imageUrls.push(cloudinaryResult.secure_url);
    }
  }

  const newFault = await Fault.create({
    faultId,
    userId,
    nameOperator: req.user?.fullName || 'Unknown Operator',
    dataCreated,
    timeCreated,
    plantId,
    partId,
    typeFault,
    comment,
    img: imageUrls,
    history: [
      {
        action: 'created',
        userId: userId,
        userName: req.user?.fullName || 'Operator',
        timestamp: new Date(),
      },
    ],
  });

  const populatedFault = await Fault.findById(newFault._id)
    .populate({ path: 'plantId', select: 'namePlant code' })
    .populate({ path: 'partId', select: 'namePlantPart codePlantPart' });

  emitFaultCreated(populatedFault);

  await logFromRequest(req, {
    action: 'fault.create',
    targetType: 'Fault',
    targetId: populatedFault._id,
    summary: `Created fault ${faultId} for plant ${populatedFault.plantId?.namePlant ?? plantId}`,
    meta: { plantId, partId, typeFault },
  });

  setImmediate(() => {
    (async () => {
      const [managers, hseUsers] = await Promise.all([
        User.find({ role: 'manager', status: 'active' }),
        typeFault === 'Safety'
          ? User.find({ role: 'safety', status: 'active' })
          : Promise.resolve([]),
      ]);
      await sendNewFaultEmail(populatedFault, managers);
      if (typeFault === 'Safety') {
        await sendSicurezzaHseEmail(populatedFault, hseUsers);
      }
    })().catch((err) =>
      console.error('[email] post-create dispatch failed', err.message),
    );
  });

  return res.status(201).json(populatedFault);
};

export const getAllFault = async (req, res) => {
  const {
    faultId,
    nameOperator,
    createdById,
    priority,
    plant,
    plantPart,
    typeFault,
    dataCreated,
    timeCreated,
    deadline,
    plannedDate,
    statusFault,
    assignedTo,
    assignedToEmpty,
    sort = 'desc',
    sortBy = 'dataCreated',
    sortOrder = 'asc',
    page = 1,
    perPage = 2,
  } = req.query;

  const query = {};

  if (deadline) query.deadline = deadline;
  if (priority) query.priority = priority;
  if (faultId) query.faultId = faultId;
  if (nameOperator) query.nameOperator = nameOperator;
  if (createdById) query.userId = createdById;
  if (typeFault) query.typeFault = typeFault;
  if (dataCreated) query.dataCreated = dataCreated;
  if (timeCreated) query.timeCreated = timeCreated;
  if (plannedDate) query.plannedDate = plannedDate;
  // assignedToEmpty takes precedence — pool fault filter
  if (assignedToEmpty === true || assignedToEmpty === 'true') {
    query.assignedMaintainers = { $size: 0 };
  } else if (assignedTo) {
    query.assignedMaintainers = assignedTo;
  }
  if (statusFault) {
    const list = Array.isArray(statusFault)
      ? statusFault
      : String(statusFault)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    query.statusFault = list.length > 1 ? { $in: list } : list[0];
  }

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

  if (plantPart) {
    const parts = await PlantPart.find({
      $or: [
        { namePlantPart: new RegExp(plantPart, 'i') },
        { codePlantPart: new RegExp(plantPart, 'i') },
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
      .populate({ path: 'partId', select: 'namePlantPart codePlantPart' })
      .populate({ path: 'assignedMaintainers', select: 'fullName email' })
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
    .populate({ path: 'partId', select: 'namePlantPart codePlantPart' })
    .populate({ path: 'assignedMaintainers', select: 'fullName email' });

  if (!fault) {
    throw createHttpError(404, 'Fault not found');
  }

  res.status(200).json(fault);
};

/**
 * GET /faults/deadlines
 *
 * Aggregated per-day counts in a date range. Replaces the
 * `?perPage=200` workaround on the maintenance-worker calendar
 * (planned counts + overdue heatmap). Returns an array sorted by
 * date so the calendar can render badges directly.
 *
 * `field` picks which Fault date column to aggregate on:
 *   - 'plannedDate' — calendar's per-day planned-intervention badges
 *   - 'deadline'    — overdue heatmap (combine with statusFault=Overdue)
 *
 * Both columns are stored as 'YYYY-MM-DD' strings on the model, so a
 * lexicographic $gte/$lte filter is equivalent to chronological.
 */
export const getFaultDeadlines = async (req, res) => {
  const {
    dateFrom,
    dateTo,
    field = 'plannedDate',
    statusFault,
    priority,
    assignedTo,
    assignedToEmpty,
  } = req.query;

  const match = {
    [field]: { $gte: dateFrom, $lte: dateTo, $ne: null },
  };

  if (priority) match.priority = priority;

  if (statusFault) {
    const list = Array.isArray(statusFault)
      ? statusFault
      : String(statusFault)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    match.statusFault = list.length > 1 ? { $in: list } : list[0];
  }

  // assignedToEmpty takes precedence over assignedTo (pool filter).
  if (assignedToEmpty === true || assignedToEmpty === 'true') {
    match.assignedMaintainers = { $size: 0 };
  } else if (assignedTo) {
    match.assignedMaintainers = new mongoose.Types.ObjectId(assignedTo);
  }

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: `$${field}`,
        count: { $sum: 1 },
        low: { $sum: { $cond: [{ $eq: ['$priority', 'Low'] }, 1, 0] } },
        medium: { $sum: { $cond: [{ $eq: ['$priority', 'Medium'] }, 1, 0] } },
        high: { $sum: { $cond: [{ $eq: ['$priority', 'High'] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const aggregated = await Fault.aggregate(pipeline);

  const dates = aggregated.map((row) => ({
    date: row._id,
    count: row.count,
    byPriority: { Low: row.low, Medium: row.medium, High: row.high },
  }));

  res.status(200).json({ field, dateFrom, dateTo, dates });
};
