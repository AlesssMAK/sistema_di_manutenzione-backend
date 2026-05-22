import { Plant } from '../models/plant.js';
import createHttpError from 'http-errors';

export const createPlant = async (req, res) => {
  const { namePlant, code, location, description } = req.body;

  if (!namePlant) {
    throw createHttpError(400, "The 'namePlant' field is required");
  }

  const existingPlant = await Plant.findOne({ code });

  if (existingPlant) {
    throw createHttpError(409, `A plant with code "${code}" already exists`);
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
  const { plantId } = req.params;
  const plant = await Plant.findOneAndUpdate(
    {
      _id: plantId,
    },
    req.body,
    {
      new: true,
    },
  );

  if (!plant) {
    throw createHttpError(404, 'Plant not found');
  }

  res.status(200).json({
    success: true,
    message: 'Plant updated successfully',
    data: plant,
  });
};
