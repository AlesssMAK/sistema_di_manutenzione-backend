import { Joi, Segments } from 'celebrate';
export const createPartPlantSchema = {
  [Segments.BODY]: Joi.object({
    plantId: Joi.string().trim().min(4).required(),
    namePartPlant: Joi.string().trim().min(4).required(),
    codePartPlant: Joi.string().trim().min(4).required(),
    location: Joi.string().min(4).trim().required(),
    description: Joi.string().trim().min(4).allow('', null).optional(),
  }),
};
