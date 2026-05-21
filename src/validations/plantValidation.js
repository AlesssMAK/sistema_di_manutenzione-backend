import { Joi, Segments } from 'celebrate';
import { STATUS } from '../constants/status.js';

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
