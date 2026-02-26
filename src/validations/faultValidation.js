import { Joi, Segments } from 'celebrate';
import { TYPE_FAULT } from '../constants/typeFault.js';

export const createFaultSchema = {
  [Segments.BODY]: Joi.object({
    // plantId и partId должны быть строками (ID из базы)
    plantId: Joi.string().trim().required(),
    partId: Joi.string().trim().required(),

    typefault: Joi.string()
      .valid(...Object.values(TYPE_FAULT))
      .default(TYPE_FAULT.PRODUZIONE),

    comment: Joi.string().trim().min(5).required(),

    img: Joi.string().uri().allow('', null),
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
