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
    // Up to 200 so the FE "pool" selects (warehouses/units/items) can
    // fetch the full roster in one request.
    perPage: Joi.number().integer().min(1).max(200).default(10),
  }),
};

/* ----------------------------- Units ----------------------------- */

export const createUnitSchema = {
  [Segments.BODY]: Joi.object({
    code: Joi.string().trim().required(),
    name: Joi.string().trim().required(),
    allowsDecimals: Joi.boolean().default(false),
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
    allowsDecimals: Joi.boolean().optional(),
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
    categoryId: objectId().allow(null),
    unitId: objectId().required(),
    packageLabel: Joi.string().trim().allow('', null),
    unitsPerPackage: Joi.number().positive().allow(null),
    // Optional reorder point set at creation. Only meaningful in a
    // single-warehouse context: the server writes it to the effective
    // warehouse's stock line (created at quantity 0). Ignored when the
    // context is ambiguous (several warehouses).
    minLevel: Joi.number().min(0).allow(null),
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
    categoryId: objectId().allow(null),
    unitId: objectId().optional(),
    packageLabel: Joi.string().trim().allow('', null),
    unitsPerPackage: Joi.number().positive().allow(null),
    // Reorder point edited from the item form (single-warehouse case).
    minLevel: Joi.number().min(0).allow(null),
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

export const listItemsSchema = {
  [Segments.QUERY]: Joi.object({
    search: Joi.string().trim().allow('', null),
    status: Joi.string().valid(...Object.values(STATUS)),
    categoryId: objectId().optional(),
    page: Joi.number().integer().min(1).default(1),
    perPage: Joi.number().integer().min(1).max(200).default(10),
  }),
};
export const listUnitsSchema = listQuery;
export const listWarehousesSchema = listQuery;

/* ------------------------- Categories ---------------------------- */

export const createCategorySchema = {
  [Segments.BODY]: Joi.object({
    name: Joi.string().trim().required(),
    status: Joi.string()
      .valid(...Object.values(STATUS))
      .default(STATUS.ACTIVE),
  }),
};

export const updateCategorySchema = {
  [Segments.PARAMS]: Joi.object({ categoryId: objectId().required() }),
  [Segments.BODY]: Joi.object({
    name: Joi.string().trim().optional(),
    status: Joi.string()
      .valid(...Object.values(STATUS))
      .optional(),
  }),
};

export const categoryIdSchema = {
  [Segments.PARAMS]: Joi.object({ categoryId: objectId().required() }),
};

export const listCategoriesSchema = listQuery;

/* ------------------------ Stock & movements ---------------------- */

export const stockQuerySchema = {
  [Segments.QUERY]: Joi.object({
    warehouseId: objectId().optional(),
    itemId: objectId().optional(),
    categoryId: objectId().optional(),
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
    // Optional: omitted when a context has a single candidate warehouse
    // (server fills the effective one). Required only when ambiguous.
    warehouseId: objectId().optional(),
    lines: Joi.array().items(movementLine).min(1).required(),
    note: Joi.string().trim().allow('', null),
  }),
};

export const stockOutSchema = {
  [Segments.BODY]: Joi.object({
    warehouseId: objectId().optional(),
    lines: Joi.array().items(movementLine).min(1).required(),
    reference: reference.default({ type: REFERENCE_TYPE.NONE }),
    note: Joi.string().trim().allow('', null),
    // Opt-in: reject (409) instead of allowing an issue that would drive a
    // line negative. Used by the fault-completion material write-off so a
    // fault can't be closed against stock that isn't there.
    strict: Joi.boolean().optional(),
  }),
};

export const stockTransferSchema = {
  [Segments.BODY]: Joi.object({
    fromWarehouseId: objectId().required(),
    toWarehouseId: objectId().required().invalid(Joi.ref('fromWarehouseId')),
    lines: Joi.array().items(movementLine).min(1).required(),
    note: Joi.string().trim().allow('', null),
  }),
};

export const stockAdjustSchema = {
  [Segments.BODY]: Joi.object({
    warehouseId: objectId().optional(),
    itemId: objectId().required(),
    // Absolute counted quantity the level should become.
    quantity: Joi.number().min(0).required(),
    note: Joi.string().trim().allow('', null),
  }),
};

// Set the reorder point for an (item x warehouse) pair. warehouseId is
// optional: when a context has a single candidate warehouse the server
// fills the effective one (the single-warehouse case where the minimum
// is edited straight from the item form).
export const stockMinSchema = {
  [Segments.BODY]: Joi.object({
    itemId: objectId().required(),
    warehouseId: objectId().optional(),
    minLevel: Joi.number().min(0).required(),
  }),
};

export const movementsQuerySchema = {
  [Segments.QUERY]: Joi.object({
    itemId: objectId().optional(),
    warehouseId: objectId().optional(),
    faultId: objectId().optional(),
    type: Joi.string().valid(...Object.values(MOVEMENT_TYPE)),
    dateFrom: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    dateTo: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    page: Joi.number().integer().min(1).default(1),
    perPage: Joi.number().integer().min(1).max(100).default(20),
  }),
};
