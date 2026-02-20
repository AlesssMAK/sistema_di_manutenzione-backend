import { PartPlant } from '../models/part.js';
import createHttpError from 'http-errors';
export const createPartPlant = async (req, res, next) => {
  try {
    const { plantId, namePartPlant, codePartPlant, location, description } =
      req.body;
    const existingPartPlant = await PartPlant.findOne({
      $or: [{ namePartPlant }, { codePartPlant }],
    });

    if (existingPartPlant) {
      throw createHttpError(409, 'A PartPlant with this name already exists');
    }

    const newPartPlant = await PartPlant.create({
      plantId,
      namePartPlant,
      codePartPlant,
      location,
      description,
    });

    res.status(201).json({
      success: true,
      message: 'PartPlant created successfully',
      data: newPartPlant,
    });
  } catch (error) {
    next(error);
  }
};
export const getAllPartPlants = async (req, res) => {
  const { plantId } = req.params;
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

  const [totalItems, partPlants] = await Promise.all([
    PartPlant.countDocuments(filter),
    PartPlant.find(filter).skip(skip).limit(perPage),
  ]);

  const totalPages = Math.ceil(totalItems / perPage);

  res.status(200).json({
    success: true,
    message: 'Get parts for plant ${plantId}',
    data: {
      partPlants,
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
