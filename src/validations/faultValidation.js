import { Joi, Segments } from 'celebrate';
import { TYPE_FAULT } from '../constants/typeFault.js';
import { isValidObjectId } from 'mongoose';

const objectIdValidator = (value, helpers) => {
  return !isValidObjectId(value) ? helpers.message('Invalid id format') : value;
};

export const createFaultSchema = {
  [Segments.BODY]: Joi.object({
    faultId: Joi.string()
      .pattern(/^SEG-\d{4}-\d{2}-\d{3}$/)
      .required(),
    dataCreated: Joi.date().iso().required(), //тільки дата, без часу
    timeCreated: Joi.string().required(),
    plantId: Joi.string().trim().required(),
    partId: Joi.string().trim().required(),

    typefault: Joi.string()
      .valid(...Object.values(TYPE_FAULT))
      .default(TYPE_FAULT.PRODUZIONE),

    comment: Joi.string().trim().min(5).required(),

    img: Joi.string().uri().allow('', null),
  }),
};

export const getAllFaultSchema = {
  [Segments.QUERY]: Joi.object({
    faultId: Joi.string().trim().optional(),
    nameOperator: Joi.string().trim().optional(),
    plant: Joi.string().trim().optional(),
    partPlant: Joi.string().trim().optional(),
    typefault: Joi.string().trim().optional(),
    dataCreated: Joi.string().trim().optional(),
    timeCreated: Joi.string().trim().optional(),
    page: Joi.number().integer().min(1).default(1),
    perPage: Joi.number().integer().min(5).max(50).default(12),
  }),
};

export const getFaultByIdSchema = {
  [Segments.PARAMS]: Joi.object({
    faultId: Joi.string().custom(objectIdValidator).required(),
  }),
};

export const addedByManagerSchema = {
  [Segments.BODY]: Joi.object({
    faultId: Joi.string().required(),
    priority: Joi.string().valid('Bassa', 'Media', 'Alta').required(),
    assignedMaintainers: Joi.array().items(Joi.string().trim()),
    plannedDate: Joi.string().required(),
    plannedTime: Joi.string().required(),
    deadline: Joi.string().required(),
    estimatedDuration: Joi.number().min(1).required(),
    managerComment: Joi.string().allow('', null),
  }),
};
