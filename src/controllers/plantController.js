import { Plant } from '../models/plant.js';
import { STATUS } from '../constants/status.js';
import createHttpError from 'http-errors';
import { logFromRequest } from '../services/auditLog.js';
import { PlantPart } from '../models/part.js';

export const createPlant = async (req, res) => {
  const { namePlant, code, location, description } = req.body;

  if (!namePlant) {
    throw createHttpError(400, "The 'namePlant' field is required");
  }

  const existingPlant = await Plant.findOne({
    $or: [{ code }, { namePlant }],
  });

  if (existingPlant) {
    if (existingPlant.code === code) {
      throw createHttpError(409, `A plant with code "${code}" already exists`);
    }
    if (existingPlant.namePlant === namePlant) {
      throw createHttpError(
        409,
        `A plant with name "${namePlant}" already exists`,
      );
    }
  }

  const newPlant = await Plant.create({
    namePlant,
    code,
    location,
    description,
  });

  await logFromRequest(req, {
    action: 'plant.create',
    targetType: 'Plant',
    targetId: newPlant._id,
    summary: `Created plant ${newPlant.namePlant} (${newPlant.code})`,
  });

  res.status(201).json({
    success: true,
    message: 'Plant created successfully',
    data: newPlant,
  });
};

export const getAllPlants = async (req, res) => {
  const { search, status, page = 1, perPage = 10 } = req.query;

  if (page < 1 || perPage < 1) {
    throw createHttpError(400, 'Page and perPage must be greater than 0');
  }

  const skip = (page - 1) * perPage;
  const plantsQuery = Plant.find();

  if (status) {
    plantsQuery.where('status').equals(status);
  }

  if (search) {
    plantsQuery.where({
      $or: [
        { namePlant: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ],
    });
  }

  const [totalItems, plants] = await Promise.all([
    plantsQuery.clone().countDocuments(),
    plantsQuery.skip(skip).limit(perPage),
  ]);

  const totalPages = Math.ceil(totalItems / perPage);

  res.status(200).json({
    success: true,
    message: 'Get all plants endpoint',
    data: {
      plants,
      pagination: {
        page,
        perPage,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
  });
};

export const updatePlant = async (req, res) => {
  const { namePlant, code } = req.body;
  const { plantId } = req.params;

  const plant = await Plant.findById(plantId);

  if (!plant) {
    throw createHttpError(404, 'Plant not found');
  }

  const existingPlant = await Plant.findOne({
    _id: { $ne: plantId },
    $or: [{ code }, { namePlant }],
  });

  if (existingPlant) {
    if (existingPlant.code === code) {
      throw createHttpError(409, `A plant with code "${code}" already exists`);
    }
    if (existingPlant.namePlant === namePlant) {
      throw createHttpError(
        409,
        `A plant with name "${namePlant}" already exists`,
      );
    }
  }

  const updatedPlant = await Plant.findByIdAndUpdate(plantId, req.body, {
    new: true,
  });

  await logFromRequest(req, {
    action: 'plant.update',
    targetType: 'Plant',
    targetId: updatedPlant._id,
    summary: `Updated plant ${updatedPlant.namePlant} (${updatedPlant.code})`,
    meta: { changed: Object.keys(req.body ?? {}) },
  });

  res.status(200).json({
    success: true,
    message: 'Plant updated successfully',
    data: updatedPlant,
  });
};

export const deactivatedPlant = async (req, res) => {
  // Soft-delete only. Previously this also ran
  // `PlantPart.deleteMany({ plantId })` — one click on the admin's
  // Elimina button could silently obliterate every historical
  // Fault.partId reference for the whole plant. Now we just flip
  // the plant's status; its parts keep their own status untouched
  // (operator dropdowns already filter by plant.status === active
  // upstream, so the parts effectively disappear from selection
  // anyway).
  const { plantId } = req.params;

  const plant = await Plant.findById(plantId);

  if (!plant) {
    throw createHttpError(404, 'Plant not found');
  }

  if (plant.status === STATUS.DEACTIVATED) {
    return res.status(200).json({
      success: true,
      message: 'Plant already deactivated',
      data: plant,
    });
  }

  plant.status = STATUS.DEACTIVATED;
  await plant.save();

  await logFromRequest(req, {
    action: 'plant.delete',
    targetType: 'Plant',
    targetId: plant._id,
    summary: `Deactivated plant ${plant.namePlant} (${plant.code})`,
  });

  res.status(200).json({
    success: true,
    message: 'Plant deactivated successfully',
    data: plant,
  });
};

export const deletePlant = async (req, res) => {
  const { plantId } = req.params;

  const plant = await Plant.findByIdAndDelete(plantId);

  if (!plant) {
    throw createHttpError(404, 'Plant not found');
  }

  const { deletedCount } = await PlantPart.deleteMany({ plantId });

  res.status(200).json({
    success: true,
    message: 'Plant deleted successfully',
    data: {
      plant,
      deletedPartsCount: deletedCount,
    },
  });
};
