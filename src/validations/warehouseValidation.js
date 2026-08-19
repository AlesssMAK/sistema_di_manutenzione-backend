import { Joi, Segments } from 'celebrate';
import { isValidObjectId } from 'mongoose';
import { STATUS } from '../constants/status.js';
import { MOVEMENT_TYPE, REFERENCE_TYPE } from '../constants/warehouse.js';

const objectIdValidator = (value, helpers) => {
  return !isValidObjectId(value) ? helpers.message('Invalid id format') : value;
};

const objectId = () => Joi.string().custom(objectIdValidator);

const listQuery = {
  [Segments.QUERY]: Joi.object({
    search: Joi.string().trim().allow('', null),
    status: Joi.string().valid(...Object.values(STATUS)),
    page: Joi.number().integer().min(1).default(1),
    perPage: Joi.number().integer().min(1).max(100).default(10),
  }),
};

/* ----------------------------- Units ----------------------------- */

export const createUnitSchema = {
  [Segments.BODY]: Joi.object({
    code: Joi.string().trim().required(),
    name: Joi.string().trim().required(),
    status: Joi.string()
      .valid(...Object.values(STATUS))
      .default(STATUS.ACTIVE),
  }),
};

export const updateUnitSchema = {
  [Segments.PARAMS]: Joi.object({ unitId: objectId().required() }),
  [Segments.BODY]: Joi.object({
    code: Joi.string().trim().optional(),
    name: Joi.string().trim().optional(),
    status: Joi.string()
      .valid(...Object.values(STATUS))
      .optional(),
  }),
};

export const unitIdSchema = {
  [Segments.PARAMS]: Joi.object({ unitId: objectId().required() }),
};

/* --------------------------- Warehouses -------------------------- */

export const createWarehouseSchema = {
  [Segments.BODY]: Joi.object({
    code: Joi.string().trim().required(),
    name: Joi.string().trim().required(),
    location: Joi.string().trim().allow('', null),
    status: Joi.string()
      .valid(...Object.values(STATUS))
      .default(STATUS.ACTIVE),
  }),
};

export const updateWarehouseSchema = {
  [Segments.PARAMS]: Joi.object({ warehouseId: objectId().required() }),
  [Segments.BODY]: Joi.object({
    code: Joi.string().trim().optional(),
    name: Joi.string().trim().optional(),
    location: Joi.string().trim().allow('', null),
    status: Joi.string()
      .valid(...Object.values(STATUS))
      .optional(),
  }),
};

export const warehouseIdSchema = {
  [Segments.PARAMS]: Joi.object({ warehouseId: objectId().required() }),
};

/* ------------------------ Inventory items ------------------------ */

export const createItemSchema = {
  [Segments.BODY]: Joi.object({
    code: Joi.string().trim().required(),
    name: Joi.string().trim().required(),
    category: Joi.string().trim().allow('', null),
    unitId: objectId().required(),
    note: Joi.string().trim().allow('', null),
    status: Joi.string()
      .valid(...Object.values(STATUS))
      .default(STATUS.ACTIVE),
  }),
};

export const updateItemSchema = {
  [Segments.PARAMS]: Joi.object({ itemId: objectId().required() }),
  [Segments.BODY]: Joi.object({
    code: Joi.string().trim().optional(),
    name: Joi.string().trim().optional(),
    category: Joi.string().trim().allow('', null),
    unitId: objectId().optional(),
    note: Joi.string().trim().allow('', null),
    status: Joi.string()
      .valid(...Object.values(STATUS))
      .optional(),
  }),
};

export const itemIdSchema = {
  [Segments.PARAMS]: Joi.object({ itemId: objectId().required() }),
};

export const itemByCodeSchema = {
  [Segments.PARAMS]: Joi.object({ code: Joi.string().trim().required() }),
};

export const listItemsSchema = listQuery;
export const listUnitsSchema = listQuery;
export const listWarehousesSchema = listQuery;

/* ------------------------ Stock & movements ---------------------- */

export const stockQuerySchema = {
  [Segments.QUERY]: Joi.object({
    warehouseId: objectId().optional(),
    itemId: objectId().optional(),
    search: Joi.string().trim().allow('', null),
    lowOnly: Joi.boolean().default(false),
    page: Joi.number().integer().min(1).default(1),
    perPage: Joi.number().integer().min(1).max(100).default(20),
  }),
};

// One line of a batch operation.
const movementLine = Joi.object({
  itemId: objectId().required(),
  quantity: Joi.number().positive().required(),
});

const reference = Joi.object({
  type: Joi.string()
    .valid(...Object.values(REFERENCE_TYPE))
    .default(REFERENCE_TYPE.NONE),
  faultId: objectId().optional(),
  label: Joi.string().trim().allow('', null),
});

export const stockInSchema = {
  [Segments.BODY]: Joi.object({
    warehouseId: objectId().required(),
    lines: Joi.array().items(movementLine).min(1).required(),
    note: Joi.string().trim().allow('', null),
  }),
};

export const stockOutSchema = {
  [Segments.BODY]: Joi.object({
    warehouseId: objectId().required(),
    lines: Joi.array().items(movementLine).min(1).required(),
    reference: reference.default({ type: REFERENCE_TYPE.NONE }),
    note: Joi.string().trim().allow('', null),
  }),
};

export const stockAdjustSchema = {
  [Segments.BODY]: Joi.object({
    warehouseId: objectId().required(),
    itemId: objectId().required(),
    // Absolute counted quantity the level should become.
    quantity: Joi.number().min(0).required(),
    note: Joi.string().trim().allow('', null),
  }),
};

export const movementsQuerySchema = {
  [Segments.QUERY]: Joi.object({
    itemId: objectId().optional(),
    warehouseId: objectId().optional(),
    faultId: objectId().optional(),
    type: Joi.string().valid(...Object.values(MOVEMENT_TYPE)),
    page: Joi.number().integer().min(1).default(1),
    perPage: Joi.number().integer().min(1).max(100).default(20),
  }),
};
