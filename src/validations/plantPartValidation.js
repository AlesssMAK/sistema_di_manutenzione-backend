import { Joi, Segments } from 'celebrate';
export const createPlantPartSchema = {
  [Segments.BODY]: Joi.object({
    plantId: Joi.string().trim().min(4).required(),
    namePlantPart: Joi.string().trim().min(4).required(),
    codePlantPart: Joi.string().trim().min(4).required(),
  }),
};
export const getPartsSchema = {
  [Segments.PARAMS]: Joi.object({
    plantId: Joi.string().hex().length(24).required().messages({
      'string.length': 'ID машины должен содержать ровно 24 символа',
      'string.hex':
        'ID машины должен содержать только шестнадцатеричные символы',
    }),
  }),
  [Segments.QUERY]: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    perPage: Joi.number().integer().min(1).default(12),
    search: Joi.string().allow('').optional(),
  }),
};
