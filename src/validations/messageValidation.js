import { Joi, Segments } from 'celebrate';
import { isValidObjectId } from 'mongoose';
import { TARGETABLE_ROLES } from '../constants/message.js';

const objectId = Joi.string().custom((value, helpers) =>
  isValidObjectId(value) ? value : helpers.message({ custom: 'Invalid id' }),
);

export const createDirectMessageSchema = {
  [Segments.BODY]: Joi.object({
    recipientId: objectId.required(),
    subject: Joi.string().trim().max(200).allow('').default(''),
    body: Joi.string().trim().min(1).max(5000).required(),
  }),
};

export const createBroadcastSchema = {
  [Segments.BODY]: Joi.object({
    target: Joi.string().valid('all', 'role').required(),
    targetRole: Joi.when('target', {
      is: 'role',
      then: Joi.string()
        .valid(...TARGETABLE_ROLES)
        .required(),
      otherwise: Joi.forbidden(),
    }),
    subject: Joi.string().trim().max(200).allow('').default(''),
    body: Joi.string().trim().min(1).max(5000).required(),
  }),
};

export const listInboxSchema = {
  [Segments.QUERY]: Joi.object({
    box: Joi.string().valid('inbox', 'sent', 'all').default('inbox'),
    page: Joi.number().integer().min(1).default(1),
    perPage: Joi.number().integer().min(1).max(50).default(20),
    unreadOnly: Joi.boolean().default(false),
  }),
};

export const listAnnouncementsSchema = {
  [Segments.QUERY]: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    perPage: Joi.number().integer().min(1).max(50).default(20),
    unreadOnly: Joi.boolean().default(false),
  }),
};

export const messageIdParamsSchema = {
  [Segments.PARAMS]: Joi.object({
    id: objectId.required(),
  }),
};
