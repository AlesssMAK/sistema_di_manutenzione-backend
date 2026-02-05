import { Plant } from '../models/plant.js';
import createHttpError from 'http-errors';

///Створюємо plants
export const createPlant = async (req, res) => {
  const { namePlant, code, location, description } = req.body;

  if (!namePlant) {
    throw createHttpError(400, "The 'namePlant' field is required");
  }
  /////Проверяем уникальность (по имени или по коду)
  const existingPlant = await Plant.findOne({
    $or: [{ namePlant }, { code }],
  });

  if (existingPlant) {
    throw createHttpError(409, 'A plant with this name already exists');
  }

  const newPlant = await Plant.create({
    namePlant,
    code,
    location,
    description,
  });

  res.status(201).json({
    success: true,
    message: 'Plant created successfully',
    data: newPlant,
  });
};
/// Список всіх plants
export const getAllPlants = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = parseInt(req.query.perPage) || 12;

  if (page < 1 || perPage < 1) {
    throw createHttpError(400, 'Page and perPage must be greater than 0');
  }

  const skip = (page - 1) * perPage;

  const filter = {};
  if (req.query.search) {
    filter.$text = { $search: req.query.search };
  }

  const [totalItems, plants] = await Promise.all([
    Plant.countDocuments(filter),
    Plant.find(filter).skip(skip).limit(perPage),
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
