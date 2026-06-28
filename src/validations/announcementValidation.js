import { Joi, Segments } from 'celebrate';
import { isValidObjectId } from 'mongoose';

const objectId = Joi.string().custom((value, helpers) =>
  isValidObjectId(value) ? value : helpers.message({ custom: 'Invalid id' }),
);

export const listPublicAnnouncementsSchema = {
  [Segments.QUERY]: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    perPage: Joi.number().integer().min(1).max(50).default(20),
  }),
};

export const createAnnouncementSchema = {
  [Segments.BODY]: Joi.object({
    title: Joi.string().trim().min(1).max(200).required(),
    body: Joi.string().trim().min(1).max(5000).required(),
  }),
};

export const announcementIdParamsSchema = {
  [Segments.PARAMS]: Joi.object({
    id: objectId.required(),
  }),
};
