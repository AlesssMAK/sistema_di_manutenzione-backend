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
      plants: [{ plantId }],
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
