import { Joi, Segments } from 'celebrate';
import { TYPE_FAULT } from '../constants/typeFault.js';
import { isValidObjectId } from 'mongoose';
import moment from 'moment';
import { STATUS_FAULT } from '../constants/statusFault.js';
import { TYPE_PRIORITY } from '../constants/typePriority.js';

const objectIdValidator = (value, helpers) => {
  return !isValidObjectId(value) ? helpers.message('Invalid id format') : value;
};

export const createFaultSchema = {
  [Segments.BODY]: Joi.object({
    faultId: Joi.string()
      .pattern(/^SEG-\d{4}-\d{2}-\d{3}$/)
      .required(),
    dataCreated: Joi.date()
      .iso()
      .required()
      .custom((value, helpers) => {
        const today = moment().startOf('day');
        const date = moment(value, 'YYYY-MM-DD');
        if (!date.isValid()) return helpers.error('any.invalid');
        if (date.isBefore(today))
          return helpers.message('plannedDate must be today or later');
        return value;
      }), //тільки дата, без часу
    timeCreated: Joi.string().required(),
    plantId: Joi.string().trim().required(),
    partId: Joi.string().trim().required(),

    typeFault: Joi.string()
      .valid(...Object.values(TYPE_FAULT))
      .default(TYPE_FAULT.PRODUCTION),

    comment: Joi.string().trim().min(5).required(),

    img: Joi.array()
      .items(
        Joi.object({
          originalname: Joi.string().required(),
          mimetype: Joi.string()
            .valid(
              'image/jpeg',
              'image/png',
              'image/webp',
              'image/jpg',
              'image/bmp',
            )
            .required(),
          size: Joi.number()
            .max(5 * 1024 * 1024)
            .required(),
        }),
      )
      .optional()
      .default([])
      .messages({
        'array.base': 'Images must be an array',
      }),
  }),
};

export const getAllFaultSchema = {
  [Segments.QUERY]: Joi.object({
    faultId: Joi.string().trim().optional(),
    nameOperator: Joi.string().trim().optional(),
    createdById: Joi.string().custom(objectIdValidator).optional(),
    plant: Joi.string().trim().optional(),
    partPlant: Joi.string().trim().optional(),
    typeFault: Joi.string().trim().optional(),
    dataCreated: Joi.string().trim().optional(),
    timeCreated: Joi.string().trim().optional(),
    deadline: Joi.string().trim().optional(),
    plannedDate: Joi.string().trim().optional(),
    assignedTo: Joi.string().trim().optional(),
    assignedToEmpty: Joi.boolean().truthy('true').falsy('false').optional(),
    // statusFault accepts a single value or a CSV list (e.g. "In progress,Suspended,Overdue")
    statusFault: Joi.string()
      .trim()
      .custom((value, helpers) => {
        const allowed = Object.values(STATUS_FAULT);
        const list = value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (!list.every((s) => allowed.includes(s))) {
          return helpers.message(
            `statusFault must contain only: ${allowed.join(', ')}`,
          );
        }
        return value;
      })
      .optional(),
    priority: Joi.string()
      .valid(...Object.values(TYPE_PRIORITY))
      .optional(),
    page: Joi.number().integer().min(1).default(1),
    // perPage temporarily up to 200 to support deadline-highlight workaround
    // on the maintenance-worker page; drop back to 50 once GET /faults/deadlines lands
    perPage: Joi.number().integer().min(1).max(200).default(2),
    sortBy: Joi.string().valid(
      'faultId',
      'nameOperator',
      'userId',
      'dataCreated',
      'plantId',
      'partId',
      'typeFault',
      'priority',
      'deadline',
      'plannedDate',
    ),
    sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
  }),
};

export const getFaultByIdSchema = {
  [Segments.PARAMS]: Joi.object({
    faultId: Joi.string().custom(objectIdValidator).required(),
  }),
};

export const addedByManagerSchema = {
  [Segments.BODY]: Joi.object({
    faultId: Joi.string().required(),
    priority: Joi.string()
      .valid(...Object.values(TYPE_PRIORITY))
      .optional(),
    assignedMaintainers: Joi.array().items(Joi.string().trim()),
    plannedDate: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required()
      .custom((value, helpers) => {
        const today = moment().startOf('day');
        const date = moment(value, 'YYYY-MM-DD');
        if (!date.isValid()) return helpers.error('any.invalid');
        if (date.isBefore(today))
          return helpers.message('plannedDate must be today or later');
        return value;
      })
      .messages({
        'string.pattern.base': 'plannedDate must be in format YYYY-MM-DD',
        'any.required': 'plannedDate is required',
      }),
    plannedTime: Joi.string().required(),
    typeFault: Joi.string()
      .valid(...Object.values(TYPE_FAULT))
      .default(TYPE_FAULT.PRODUCTION),
    deadline: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required()
      .custom((value, helpers) => {
        const { plannedDate } = helpers.state.ancestors[0];
        const start = moment(plannedDate, 'YYYY-MM-DD');
        const end = moment(value, 'YYYY-MM-DD');
        if (!end.isValid()) return helpers.error('any.invalid');
        if (end.isBefore(start))
          return helpers.message(
            ' deadline must be after or equal to plannedDate',
          );
        return value;
      }),
    estimatedDuration: Joi.number().min(1).required(),
    managerComment: Joi.string().allow('', null),
  }),
};

export const addFaultByMaintenanceWorkerSchema = {
  [Segments.BODY]: Joi.object({
    faultId: Joi.string().required(),
    statusFault: Joi.string()
      .valid(...Object.values(STATUS_FAULT))
      .default(STATUS_FAULT.CREATED)
      .required(),
    commentMaintenanceWorker: Joi.string().optional(),
  }),
};

export const updateFaultByMaintenanceWorkerSchema = {
  [Segments.PARAMS]: Joi.object({
    faultId: Joi.string().custom(objectIdValidator).required(),
  }),
  [Segments.BODY]: Joi.object({
    statusFault: Joi.string()
      .valid(...Object.values(STATUS_FAULT))
      .required(),
    commentMaintenanceWorker: Joi.string().allow('', null).optional(),
    actualDuration: Joi.alternatives().conditional('statusFault', {
      is: STATUS_FAULT.COMPLETED,
      then: Joi.number().min(1).required().messages({
        'any.required': 'actualDuration is required when statusFault is Completed',
      }),
      otherwise: Joi.number().min(1).optional(),
    }),
    suspensionReason: Joi.alternatives().conditional('statusFault', {
      is: STATUS_FAULT.SUSPENDED,
      then: Joi.string().trim().min(3).required().messages({
        'any.required': 'suspensionReason is required when statusFault is Suspended',
      }),
      otherwise: Joi.string().trim().allow('', null).optional(),
    }),
    materialRequest: Joi.string().trim().allow('', null).optional(),
  }),
};

export const claimFaultSchema = {
  [Segments.PARAMS]: Joi.object({
    faultId: Joi.string().custom(objectIdValidator).required(),
  }),
};

export const updateFaultBySafetySchema = {
  [Segments.PARAMS]: Joi.object({
    faultId: Joi.string().custom(objectIdValidator).required(),
  }),
  [Segments.BODY]: Joi.object({
    commentSafety: Joi.string().trim().allow('').max(2000).required(),
  }),
};
