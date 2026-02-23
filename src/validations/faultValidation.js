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
