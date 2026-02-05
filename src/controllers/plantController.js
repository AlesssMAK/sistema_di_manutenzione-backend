import { Plant } from '../models/plant.js';
import createHttpError from 'http-errors';
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
