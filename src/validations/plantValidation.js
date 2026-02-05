import { Joi, Segments } from 'celebrate';

export const createPlantSchema = {
  [Segments.BODY]: Joi.object({
    namePlant: Joi.string().trim().min(4).required(),
    code: Joi.string().trim().min(4).required(),
    location: Joi.string().min(4).trim().required(),
    description: Joi.string().trim().min(4).allow('', null),
  }),
};
