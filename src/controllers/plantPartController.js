import { PlantPart } from '../models/part.js';
import createHttpError from 'http-errors';
import { Plant } from '../models/plant.js';
export const createPlantPart = async (req, res, next) => {
  try {
    const { plantId, namePlantPart, codePlantPart, location, description } =
      req.body;
    const existingPlantPart = await PlantPart.findOne({
      $or: [{ namePlantPart }, { codePlantPart }],
    });

    if (existingPlantPart) {
      throw createHttpError(409, 'A PlantPart with this name already exists');
    }

    const newPlantPart = await PlantPart.create({
      plantId,
      namePlantPart,
      codePlantPart,
      location,
      description,
    });

    res.status(201).json({
      success: true,
      message: 'PlantPart created successfully',
      data: newPlantPart,
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
  const page = parseInt(req.query.page) || 1;
  const perPage = parseInt(req.query.perPage) || 12;

  if (page < 1 || perPage < 1) {
    throw createHttpError(400, 'Page and perPage must be greater than 0');
  }

  const skip = (page - 1) * perPage;

  const filter = { plantId };
  if (req.query.search) {
    filter.$text = { $search: req.query.search };
  }

  const [totalItems, plantParts] = await Promise.all([
    PlantPart.countDocuments(filter),
    PlantPart.find(filter).skip(skip).limit(perPage),
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
