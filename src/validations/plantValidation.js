import { Joi, Segments } from 'celebrate';
import { STATUS } from '../constants/status.js';
import { isValidObjectId } from 'mongoose';

const objectIdValidator = (value, helpers) => {
  return !isValidObjectId(value) ? helpers.message('Invalid id format') : value;
};

export const createPlantSchema = {
  [Segments.BODY]: Joi.object({
    namePlant: Joi.string().trim().required(),
    code: Joi.string().trim().required(),
    location: Joi.string().trim().required(),
    description: Joi.string().trim().allow('', null),
    status: Joi.string()
      .valid(...Object.values(STATUS))
      .default(STATUS.ACTIVE),
  }),
};

export const deletePlantSchema = {
  [Segments.PARAMS]: Joi.object({
    plantId: Joi.string().custom(objectIdValidator).required(),
  }),
};

export const updatePlantSchema = {
  ...deletePlantSchema,
  [Segments.BODY]: Joi.object({
    namePlant: Joi.string().trim().optional(),
    code: Joi.string().trim().optional(),
    location: Joi.string().trim().optional(),
    description: Joi.string().trim().allow('', null),
    status: Joi.string()
      .valid(...Object.values(STATUS))
      .optional(),
  }),
};
