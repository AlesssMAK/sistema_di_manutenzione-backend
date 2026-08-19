import { Router } from 'express';
import { celebrate } from 'celebrate';
import { authenticate } from '../middleware/authenticate.js';
import {
  requireWarehouseEnabled,
  requireWarehousePermission,
} from '../middleware/warehousePermission.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import {
  createUnitSchema,
  updateUnitSchema,
  unitIdSchema,
  listUnitsSchema,
  createWarehouseSchema,
  updateWarehouseSchema,
  warehouseIdSchema,
  listWarehousesSchema,
  createItemSchema,
  updateItemSchema,
  itemIdSchema,
  itemByCodeSchema,
  listItemsSchema,
  stockQuerySchema,
  stockInSchema,
  stockOutSchema,
  stockAdjustSchema,
  movementsQuerySchema,
} from '../validations/warehouseValidation.js';
import {
  createUnit,
  getAllUnits,
  updateUnit,
  deactivateUnit,
} from '../controllers/unitController.js';
import {
  createWarehouse,
  getAllWarehouses,
  updateWarehouse,
  deactivateWarehouse,
} from '../controllers/warehouseController.js';
import {
  createItem,
  getAllItems,
  getItemByCode,
  updateItem,
  deactivateItem,
} from '../controllers/inventoryItemController.js';
import {
  getStock,
  stockIn,
  stockOut,
  stockAdjust,
  getMovements,
} from '../controllers/stockController.js';

const router = Router();

// Access is by admin-granted per-user permission, not by role, so the
// warehouse can be handed to whoever needs it (incl. a future
// warehouse-keeper). Anyone with either grant can read; catalog writes
// need canManageWarehouse; stock moves need canOperateWarehouse.
const canRead = requireWarehousePermission(
  'canManageWarehouse',
  'canOperateWarehouse',
);
const canManage = requireWarehousePermission('canManageWarehouse');
const canMove = requireWarehousePermission('canOperateWarehouse');

/* ------------------------------ Units ---------------------------- */
router.get(
  '/warehouse/units',
  authenticate,
  requireWarehouseEnabled,
  canRead,
  celebrate(listUnitsSchema),
  ctrlWrapper(getAllUnits),
);
router.post(
  '/warehouse/units',
  authenticate,
  requireWarehouseEnabled,
  canManage,
  celebrate(createUnitSchema),
  ctrlWrapper(createUnit),
);
router.put(
  '/warehouse/units/:unitId',
  authenticate,
  requireWarehouseEnabled,
  canManage,
  celebrate(updateUnitSchema),
  ctrlWrapper(updateUnit),
);
router.delete(
  '/warehouse/units/:unitId',
  authenticate,
  requireWarehouseEnabled,
  canManage,
  celebrate(unitIdSchema),
  ctrlWrapper(deactivateUnit),
);

/* --------------------------- Warehouses -------------------------- */
router.get(
  '/warehouse/warehouses',
  authenticate,
  requireWarehouseEnabled,
  canRead,
  celebrate(listWarehousesSchema),
  ctrlWrapper(getAllWarehouses),
);
router.post(
  '/warehouse/warehouses',
  authenticate,
  requireWarehouseEnabled,
  canManage,
  celebrate(createWarehouseSchema),
  ctrlWrapper(createWarehouse),
);
router.put(
  '/warehouse/warehouses/:warehouseId',
  authenticate,
  requireWarehouseEnabled,
  canManage,
  celebrate(updateWarehouseSchema),
  ctrlWrapper(updateWarehouse),
);
router.delete(
  '/warehouse/warehouses/:warehouseId',
  authenticate,
  requireWarehouseEnabled,
  canManage,
  celebrate(warehouseIdSchema),
  ctrlWrapper(deactivateWarehouse),
);

/* ------------------------ Inventory items ------------------------ */
router.get(
  '/warehouse/items',
  authenticate,
  requireWarehouseEnabled,
  canRead,
  celebrate(listItemsSchema),
  ctrlWrapper(getAllItems),
);
router.get(
  '/warehouse/items/by-code/:code',
  authenticate,
  requireWarehouseEnabled,
  canRead,
  celebrate(itemByCodeSchema),
  ctrlWrapper(getItemByCode),
);
router.post(
  '/warehouse/items',
  authenticate,
  requireWarehouseEnabled,
  canManage,
  celebrate(createItemSchema),
  ctrlWrapper(createItem),
);
router.put(
  '/warehouse/items/:itemId',
  authenticate,
  requireWarehouseEnabled,
  canManage,
  celebrate(updateItemSchema),
  ctrlWrapper(updateItem),
);
router.delete(
  '/warehouse/items/:itemId',
  authenticate,
  requireWarehouseEnabled,
  canManage,
  celebrate(itemIdSchema),
  ctrlWrapper(deactivateItem),
);

/* ------------------------ Stock & movements ---------------------- */
router.get(
  '/warehouse/stock',
  authenticate,
  requireWarehouseEnabled,
  canRead,
  celebrate(stockQuerySchema),
  ctrlWrapper(getStock),
);
router.get(
  '/warehouse/movements',
  authenticate,
  requireWarehouseEnabled,
  canRead,
  celebrate(movementsQuerySchema),
  ctrlWrapper(getMovements),
);
router.post(
  '/warehouse/movements/in',
  authenticate,
  requireWarehouseEnabled,
  canMove,
  celebrate(stockInSchema),
  ctrlWrapper(stockIn),
);
router.post(
  '/warehouse/movements/out',
  authenticate,
  requireWarehouseEnabled,
  canMove,
  celebrate(stockOutSchema),
  ctrlWrapper(stockOut),
);
router.post(
  '/warehouse/movements/adjust',
  authenticate,
  requireWarehouseEnabled,
  canMove,
  celebrate(stockAdjustSchema),
  ctrlWrapper(stockAdjust),
);

export default router;
