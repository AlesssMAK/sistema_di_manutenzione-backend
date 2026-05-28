import { Joi, Segments } from 'celebrate';
import { isValidObjectId } from 'mongoose';
import {
  AUDIT_ACTIONS,
  AUDIT_ACTOR_ROLES,
  AUDIT_TARGETS,
} from '../constants/auditLog.js';

const objectIdValidator = (value, helpers) =>
  !isValidObjectId(value) ? helpers.message('Invalid id format') : value;

export const listAuditLogSchema = {
  [Segments.QUERY]: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    perPage: Joi.number().integer().min(1).max(100).default(20),

    actorId: Joi.string().custom(objectIdValidator),
    actorRole: Joi.string().valid(...AUDIT_ACTOR_ROLES),
    action: Joi.string().valid(...AUDIT_ACTIONS),
    targetType: Joi.string().valid(...AUDIT_TARGETS),
    targetId: Joi.string().custom(objectIdValidator),

    from: Joi.date().iso(),
    to: Joi.date().iso().greater(Joi.ref('from')),

    sort: Joi.string().valid('createdAt', '-createdAt').default('-createdAt'),
  }),
};

export const getAuditLogByIdSchema = {
  [Segments.PARAMS]: Joi.object({
    id: Joi.string().custom(objectIdValidator).required(),
  }),
};
