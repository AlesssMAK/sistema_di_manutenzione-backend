import { Joi, Segments } from 'celebrate';
import { isValidObjectId } from 'mongoose';
import { MESSAGE_TYPE, TARGETABLE_ROLES } from '../constants/message.js';

const BROADCAST_TYPES = [MESSAGE_TYPE.BROADCAST_ALL, MESSAGE_TYPE.BROADCAST_ROLE];

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
    // Optional CSV filter: "broadcast_all", "broadcast_role", or both.
    // Lets the FE call the same endpoint for different views — e.g. the bell
    // dropdown wants only broadcast_role, the /reports page wants both.
    types: Joi.string()
      .trim()
      .custom((value, helpers) => {
        const list = value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (!list.every((t) => BROADCAST_TYPES.includes(t))) {
          return helpers.message(
            `types must contain only: ${BROADCAST_TYPES.join(', ')}`,
          );
        }
        return value;
      })
      .optional(),
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

export const replyMessageSchema = {
  [Segments.PARAMS]: Joi.object({
    id: objectId.required(),
  }),
  [Segments.BODY]: Joi.object({
    subject: Joi.string().trim().max(200).allow('').default(''),
    body: Joi.string().trim().min(1).max(5000).required(),
  }),
};
