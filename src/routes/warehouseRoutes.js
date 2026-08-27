import { Router } from 'express';
import { celebrate } from 'celebrate';
import { authenticate } from '../middleware/authenticate.js';
import {
  requireWarehouseEnabled,
  requireWarehousePermission,
  requireWarehouseRead,
} from '../middleware/warehousePermission.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import {
  createUnitSchema,
  updateUnitSchema,
  unitIdSchema,
  listUnitsSchema,
  createCategorySchema,
  updateCategorySchema,
  categoryIdSchema,
  listCategoriesSchema,
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
  stockTransferSchema,
  stockMinSchema,
  movementsQuerySchema,
} from '../validations/warehouseValidation.js';
import {
  createUnit,
  getAllUnits,
  updateUnit,
  deactivateUnit,
} from '../controllers/unitController.js';
import {
  createCategory,
  getAllCategories,
  updateCategory,
  deactivateCategory,
} from '../controllers/categoryController.js';
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
  stockTransfer,
  stockSetMin,
  getMovements,
} from '../controllers/stockController.js';

const router = Router();

// Access is by admin-granted per-user permission, not by role, so the
// warehouse can be handed to whoever needs it (incl. a future
// warehouse-keeper). Anyone with either grant can read; catalog writes
// need canManageWarehouse; stock moves need canOperateWarehouse.
// Reads are open to maintenance workers too (they need the catalog to
// issue fault materials); writes stay behind the grants.
const canRead = requireWarehouseRead;
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

/* ---------------------------- Categories ------------------------- */
router.get(
  '/warehouse/categories',
  authenticate,
  requireWarehouseEnabled,
  canRead,
  celebrate(listCategoriesSchema),
  ctrlWrapper(getAllCategories),
);
router.post(
  '/warehouse/categories',
  authenticate,
  requireWarehouseEnabled,
  canManage,
  celebrate(createCategorySchema),
  ctrlWrapper(createCategory),
);
router.put(
  '/warehouse/categories/:categoryId',
  authenticate,
  requireWarehouseEnabled,
  canManage,
  celebrate(updateCategorySchema),
  ctrlWrapper(updateCategory),
);
router.delete(
  '/warehouse/categories/:categoryId',
  authenticate,
  requireWarehouseEnabled,
  canManage,
  celebrate(categoryIdSchema),
  ctrlWrapper(deactivateCategory),
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
// OUT is the one write open to maintenance workers, but only as a fault
// write-off on their own fault — the controller enforces that. General
// issues (task/none) still require canOperateWarehouse there. canRead is
// the baseline gate (keeps plain operators out entirely).
router.post(
  '/warehouse/movements/out',
  authenticate,
  requireWarehouseEnabled,
  canRead,
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
router.post(
  '/warehouse/movements/transfer',
  authenticate,
  requireWarehouseEnabled,
  canMove,
  celebrate(stockTransferSchema),
  ctrlWrapper(stockTransfer),
);
router.patch(
  '/warehouse/stock/min',
  authenticate,
  requireWarehouseEnabled,
  canMove,
  celebrate(stockMinSchema),
  ctrlWrapper(stockSetMin),
);

export default router;
