import { Joi, Segments } from 'celebrate';
import { STATUS } from '../constants/status.js';

export const createPlantSchema = {
  [Segments.BODY]: Joi.object({
    namePlant: Joi.string().trim().min(4).required(),
    code: Joi.string().trim().min(4).required(),
    location: Joi.string().min(4).trim().required(),
    description: Joi.string().trim().min(4).allow('', null),
    status: Joi.string()
      .valid(...Object.values(STATUS))
      .default(STATUS.ACTIVE),
  }),
};
