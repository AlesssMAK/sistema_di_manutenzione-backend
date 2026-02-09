import { Joi, Segments } from 'celebrate';
export const createPartPlantSchema = {
  [Segments.BODY]: Joi.object({
    plants: Joi.array()
      .items(
        Joi.object({
          plantId: Joi.string().required(),
        }),
      )
      .min(1)
      .required(),
  }),
  namePartPlant: Joi.string().trim().min(4).required(),
  codePartPlant: Joi.string().trim().min(4).required(),
  location: Joi.string().min(4).trim().required(),
  description: Joi.string().trim().min(4).allow('', null),
};
