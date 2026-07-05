import { Joi, Segments } from 'celebrate';
import { isValidObjectId } from 'mongoose';

const objectId = Joi.string().custom((value, helpers) =>
  isValidObjectId(value) ? value : helpers.message({ custom: 'Invalid id' }),
);

export const listPublicAnnouncementsSchema = {
  [Segments.QUERY]: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    perPage: Joi.number().integer().min(1).max(50).default(20),
    category: Joi.string().valid('announcement', 'handover'),
  }),
};

export const createAnnouncementSchema = {
  [Segments.BODY]: Joi.object({
    title: Joi.string().trim().max(200).allow('').default(''),
    body: Joi.string().trim().max(5000).allow('').default(''),
    category: Joi.string()
      .valid('announcement', 'handover')
      .default('announcement'),
    // Optional machine — only used for `handover`. Empty string / null
    // are accepted so the form can submit "no machine selected".
    plantId: objectId.optional().allow(null, ''),
    severity: Joi.string()
      .valid('normal', 'communication', 'note', 'important', 'attention')
      .default('normal'),
  }),
};

export const announcementIdParamsSchema = {
  [Segments.PARAMS]: Joi.object({
    id: objectId.required(),
  }),
};
