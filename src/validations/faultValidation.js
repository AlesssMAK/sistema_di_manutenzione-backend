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

    typefault: Joi.string()
      .valid(...Object.values(TYPE_FAULT))
      .default(TYPE_FAULT.PRODUCTION),

    comment: Joi.string().trim().min(5).required(),

    img: Joi.string().uri().allow('', null),
  }),
};

export const getAllFaultSchema = {
  [Segments.QUERY]: Joi.object({
    faultId: Joi.string().trim().optional(),
    nameOperator: Joi.string().trim().optional(),
    plant: Joi.string().trim().optional(),
    partPlant: Joi.string().trim().optional(),
    typefault: Joi.string().trim().optional(),
    dataCreated: Joi.string().trim().optional(),
    timeCreated: Joi.string().trim().optional(),
    deadline: Joi.string().trim().optional(),
    priority: Joi.string()
      .valid(...Object.values(TYPE_PRIORITY))
      .optional(),
    page: Joi.number().integer().min(1).default(1),
    perPage: Joi.number().integer().min(5).max(50).default(12),
    sortBy: Joi.string().valid(
      'faultId',
      'nameOperator',
      'userId',
      'dataCreated',
      'plantId',
      'partId',
      'typefault',
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
    priority: Joi.string().valid('Bassa', 'Media', 'Alta').required(),
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
    statusfault: Joi.string()
      .valid(...Object.values(STATUS_FAULT))
      .default(STATUS_FAULT.CREATED)
      .required(),
    commentMaintenanceWorker: Joi.string().optional(),
  }),
};
