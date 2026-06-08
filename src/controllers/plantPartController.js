import { PlantPart } from '../models/part.js';
import createHttpError from 'http-errors';
import { Plant } from '../models/plant.js';

export const createPlantParts = async (req, res, next) => {
  try {
    const { plantId, parts } = req.body;

    if (!Array.isArray(parts) || parts.length === 0) {
      throw createHttpError(400, 'Parts array is required');
    }

    const codes = parts.map((p) => p.codePlantPart);
    const existing = await PlantPart.find({ codePlantPart: { $in: codes } });

    if (existing.length > 0) {
      throw createHttpError(
        409,
        `Plant parts with these codes already exist: ${existing
          .map((e) => e.codePlantPart)
          .join(', ')}`,
      );
    }

    const partsToCreate = parts.map((p) => ({
      plantId,
      namePlantPart: p.namePlantPart,
      codePlantPart: p.codePlantPart,
    }));

    const createdParts = await PlantPart.insertMany(partsToCreate);

    res.status(201).json({
      success: true,
      message: 'Plant parts created successfully',
      data: createdParts,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllPlantParts = async (req, res) => {
  const { plantId } = req.params;

  const isPlantExist = await Plant.exists({ _id: plantId });

  if (!isPlantExist) {
    throw createHttpError(404, `Plant with ID ${plantId} not found`);
  }

  const { search, status, page = 1, perPage = 10 } = req.query;

  if (page < 1 || perPage < 1) {
    throw createHttpError(400, 'Page and perPage must be greater than 0');
  }

  const skip = (page - 1) * perPage;
  const plantPartsQuery = PlantPart.find({ plantId });

  if (status) {
    plantPartsQuery.where('status').equals(status);
  }

  if (search) {
    plantPartsQuery.where({
      $or: [
        { namePlantPart: { $regex: search, $options: 'i' } },
        { codePlantPart: { $regex: search, $options: 'i' } },
      ],
    });
  }

  const [totalItems, plantParts] = await Promise.all([
    plantPartsQuery.clone().countDocuments(),
    plantPartsQuery.skip(skip).limit(perPage),
  ]);

  const totalPages = Math.ceil(totalItems / perPage);

  res.status(200).json({
    success: true,
    message: 'Get parts for plant ${plantId}',
    data: {
      plantParts,
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

export const updatePlantPart = async (req, res) => {
  const { plantPartId } = req.params;
  const plantPart = await PlantPart.findOneAndUpdate(
    {
      _id: plantPartId,
    },
    req.body,
    {
      new: true,
    },
  );

  if (!plantPart) {
    throw createHttpError(404, 'Plant part not found');
  }

  res.status(200).json({ success: true, plantPart: plantPart });
};

export const deletePlantPart = async (req, res) => {
  const { plantPartId } = req.params;
  const plantPart = await PlantPart.findByIdAndDelete(plantPartId);

  if (!plantPart) {
    throw createHttpError(404, 'Plant part not found');
  }

  res.status(200).json({
    success: true,
    message: 'Plant part deleted successfully',
  });
};
