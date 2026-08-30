import { Joi, Segments } from 'celebrate';
import { TYPE_FAULT } from '../constants/typeFault.js';
import { isValidObjectId } from 'mongoose';
import { DateTime } from 'luxon';
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
        // Joi.date().iso() already parsed value into a Date object.
        const today = DateTime.now().startOf('day');
        const date = DateTime.fromJSDate(value).startOf('day');
        if (!date.isValid) return helpers.error('any.invalid');
        if (date < today)
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
    // Free-text search: partial, case-insensitive match on faultId
    // OR nameOperator (controller builds the $or regex).
    search: Joi.string().trim().optional(),
    createdById: Joi.string().custom(objectIdValidator).optional(),
    plant: Joi.string().trim().optional(),
    partPlant: Joi.string().trim().optional(),
    typeFault: Joi.string().trim().optional(),
    dataCreated: Joi.string().trim().optional(),
    // Lower bound for a "created since" window (YYYY-MM-DD). Used by the
    // public board's Segnalazioni tab to show a rolling recent window.
    dataCreatedFrom: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .messages({
        'string.pattern.base': 'dataCreatedFrom must be in format YYYY-MM-DD',
      }),
    timeCreated: Joi.string().trim().optional(),
    deadline: Joi.string().trim().optional(),
    plannedDate: Joi.string().trim().optional(),
    // Planned-date range (from the Filtri panel).
    plannedDateFrom: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    plannedDateTo: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    // Deadline range — the "In ritardo" tab's calendar buckets by deadline,
    // so a day click / Filtri range narrows the list by deadline too.
    deadlineFrom: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    deadlineTo: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    // Completed-at range (Date column) — the "Completate" tab buckets by
    // the day a fault was closed. Bounds are 'YYYY-MM-DD'; the controller
    // turns them into a timezone-aware instant range.
    completedFrom: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    completedTo: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
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
    // Direction of the primary `createdAt` sort (the controller reads
    // `sort`; without this the strict schema rejected it). asc = oldest
    // first — used by the maintenance-worker combined queue.
    sort: Joi.string().valid('asc', 'desc').optional(),
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
      'completedAt',
    ),
    sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
    // Opt-in unseen annotation for the fault boards. withUnseen turns on
    // per-card `unseen` + board-level `hasUnseen`; seenSince is the current
    // list's lastSeen (model A for faults assigned to others).
    withUnseen: Joi.boolean().truthy('true').falsy('false').optional(),
    seenSince: Joi.date().iso().optional(),
  }),
};

export const patchListSeenSchema = {
  [Segments.BODY]: Joi.object({
    key: Joi.string()
      .valid(
        'worker_active',
        'worker_inProgress',
        'worker_suspended',
        'worker_overdue',
        'worker_completed',
        'worker_pool',
        'manager_received',
        'manager_suspended',
        'manager_inprogress',
        'manager_archive',
        'safety_all',
      )
      .required(),
  }),
};

export const getFaultByIdSchema = {
  [Segments.PARAMS]: Joi.object({
    faultId: Joi.string().custom(objectIdValidator).required(),
  }),
};

export const getDeadlinesSchema = {
  [Segments.QUERY]: Joi.object({
    dateFrom: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required()
      .messages({
        'string.pattern.base': 'dateFrom must be in format YYYY-MM-DD',
      }),
    dateTo: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .required()
      .messages({
        'string.pattern.base': 'dateTo must be in format YYYY-MM-DD',
      }),
    // Which Fault field to aggregate on. plannedDate covers the planning
    // tabs' per-day badges; deadline covers the "In ritardo" tab;
    // completedAt covers the "Completate" tab (closed-per-day badges).
    field: Joi.string()
      .valid('plannedDate', 'deadline', 'completedAt')
      .default('plannedDate'),
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
    assignedTo: Joi.string().custom(objectIdValidator).optional(),
    assignedToEmpty: Joi.boolean().truthy('true').falsy('false').optional(),
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
        const today = DateTime.now().startOf('day');
        const date = DateTime.fromISO(value);
        if (!date.isValid) return helpers.error('any.invalid');
        if (date < today)
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
        const start = DateTime.fromISO(plannedDate);
        const end = DateTime.fromISO(value);
        if (!end.isValid) return helpers.error('any.invalid');
        if (end < start)
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
    // Optional even on completion: the controller applies the floor
    // (never below the already-worked time) and the 15-minute default for
    // an empty/zero value, so validation only guards the numeric shape.
    actualDuration: Joi.number().min(0).optional(),
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

export const reassignFaultSchema = {
  [Segments.PARAMS]: Joi.object({
    faultId: Joi.string().custom(objectIdValidator).required(),
  }),
  [Segments.BODY]: Joi.object({
    // New full list of assignees (empty array = move back to pool).
    // Backend diffs against the current value to figure out who was
    // added and who was removed.
    assignedMaintainers: Joi.array()
      .items(Joi.string().custom(objectIdValidator))
      .required(),
  }),
};

export const addMaintainersSchema = {
  [Segments.PARAMS]: Joi.object({
    faultId: Joi.string().custom(objectIdValidator).required(),
  }),
  [Segments.BODY]: Joi.object({
    // Only the new maintainers to append; controller rejects ids
    // already on the fault so the FE doesn't have to recompute the
    // diff itself.
    additionalMaintainers: Joi.array()
      .items(Joi.string().custom(objectIdValidator))
      .min(1)
      .required(),
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
