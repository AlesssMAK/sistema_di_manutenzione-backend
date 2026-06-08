import { Joi, Segments } from 'celebrate';
import { STATUS } from '../constants/status.js';
import { isValidObjectId } from 'mongoose';

const objectIdValidator = (value, helpers) => {
  return !isValidObjectId(value) ? helpers.message('Invalid id format') : value;
};

export const createPlantPartsSchema = {
  [Segments.BODY]: Joi.object({
    plantId: Joi.string().custom(objectIdValidator).trim().required(),

    parts: Joi.array()
      .items(
        Joi.object({
          namePlantPart: Joi.string().trim().required(),
          codePlantPart: Joi.string().trim().required(),
          status: Joi.string()
            .valid(...Object.values(STATUS))
            .default(STATUS.ACTIVE),
        }),
      )
      .min(1)
      .required(),
  }),
};

export const getPartsSchema = {
  [Segments.PARAMS]: Joi.object({
    plantId: Joi.string().hex().length(24).required().messages({
      'string.length': 'The machine ID must contain exactly 24 characters',
      'string.hex': 'The machine ID must contain only hexadecimal characters',
    }),
  }),
  [Segments.QUERY]: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    perPage: Joi.number().integer().min(1).default(12),
    search: Joi.string().allow('').optional(),
    status: Joi.string()
      .valid(...Object.values(STATUS))
      .optional(),
  }),
};

export const deletePlantPartSchema = {
  [Segments.PARAMS]: Joi.object({
    plantId: Joi.string().required(),
    plantPartId: Joi.string().custom(objectIdValidator).required(),
  }),
};

export const updatePlantPartSchema = {
  ...deletePlantPartSchema,
  [Segments.BODY]: Joi.object({
    namePlantPart: Joi.string().trim().optional(),
    codePlantPart: Joi.string().trim().optional(),
    status: Joi.string()
      .valid(...Object.values(STATUS))
      .optional(),
  }),
};
