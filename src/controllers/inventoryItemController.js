import createHttpError from 'http-errors';
import { InventoryItem } from '../models/inventoryItem.js';
import { Unit } from '../models/unit.js';
import { STATUS } from '../constants/status.js';
import { isDemoMode } from '../constants/demo.js';
import { logFromRequest } from '../services/auditLog.js';
import {
  resolveManagementWarehouse,
  setMinLevel,
} from '../services/warehouseContext.js';

export const createItem = async (req, res) => {
  const {
    code,
    name,
    categoryId,
    unitId,
    packageLabel,
    unitsPerPackage,
    minLevel,
    note,
    status,
  } = req.body;

  if (isDemoMode()) {
    return res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: {
        _id: 'demo',
        code,
        name,
        categoryId,
        unitId,
        packageLabel,
        unitsPerPackage,
        minLevel,
        note,
      },
    });
  }

  const unit = await Unit.findById(unitId);
  if (!unit || unit.status !== STATUS.ACTIVE) {
    throw createHttpError(400, 'Invalid or inactive unit');
  }

  const existing = await InventoryItem.findOne({ code });
  if (existing) {
    throw createHttpError(409, `An item with code "${code}" already exists`);
  }

  const item = await InventoryItem.create({
    code,
    name,
    categoryId,
    unitId,
    packageLabel,
    unitsPerPackage,
    note,
    status,
  });

  // Reorder point set from the item form: only meaningful in the single-
  // warehouse case, where it materialises the stock line (quantity 0) of
  // the effective warehouse. Ignored when the warehouse is ambiguous.
  if (minLevel !== undefined && minLevel !== null) {
    const warehouse = await resolveManagementWarehouse(req.user);
    if (warehouse) await setMinLevel(item._id, warehouse._id, minLevel);
  }

  await logFromRequest(req, {
    action: 'inventoryItem.create',
    targetType: 'InventoryItem',
    targetId: item._id,
    summary: `Created item ${item.name} (${item.code})`,
  });

  res.status(201).json({
    success: true,
    message: 'Item created successfully',
    data: item,
  });
};

// Resolve a scanned QR/barcode (the item's SKU) to the item. Used by
// the camera scanner in the stock movement flows.
export const getItemByCode = async (req, res) => {
  const { code } = req.params;
  const item = await InventoryItem.findOne({ code })
    .populate('unitId', 'code name allowsDecimals')
    .populate('categoryId', 'name');
  if (!item) throw createHttpError(404, 'Item not found');

  res.status(200).json({
    success: true,
    message: 'Get item by code endpoint',
    data: item,
  });
};

export const getAllItems = async (req, res) => {
  const { search, status, categoryId, page = 1, perPage = 10 } = req.query;
  const skip = (page - 1) * perPage;

  const query = InventoryItem.find();
  if (status) query.where('status').equals(status);
  if (categoryId) query.where('categoryId').equals(categoryId);
  if (search) {
    query.where({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ],
    });
  }

  const [totalItems, items] = await Promise.all([
    query.clone().countDocuments(),
    query
      .sort({ name: 1 })
      .skip(skip)
      .limit(perPage)
      .populate('unitId', 'code name allowsDecimals')
      .populate('categoryId', 'name'),
  ]);

  const totalPages = Math.ceil(totalItems / perPage);

  res.status(200).json({
    success: true,
    message: 'Get all items endpoint',
    data: {
      items,
      pagination: {
        page,
        perPage,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
  });
};

export const updateItem = async (req, res) => {
  const { itemId } = req.params;
  // minLevel is not a field on the item; it lives on the (item x
  // warehouse) stock line, so pull it out and apply it separately.
  const { minLevel, ...itemFields } = req.body;
  const { code, unitId } = itemFields;

  const item = await InventoryItem.findById(itemId);
  if (!item) throw createHttpError(404, 'Item not found');

  if (unitId) {
    const unit = await Unit.findById(unitId);
    if (!unit || unit.status !== STATUS.ACTIVE) {
      throw createHttpError(400, 'Invalid or inactive unit');
    }
  }

  if (code) {
    const clash = await InventoryItem.findOne({ _id: { $ne: itemId }, code });
    if (clash) {
      throw createHttpError(409, `An item with code "${code}" already exists`);
    }
  }

  const updated = await InventoryItem.findByIdAndUpdate(itemId, itemFields, {
    new: true,
  })
    .populate('unitId', 'code name allowsDecimals')
    .populate('categoryId', 'name');

  // Reorder point edited from the item form (single-warehouse case).
  if (minLevel !== undefined && minLevel !== null) {
    const warehouse = await resolveManagementWarehouse(req.user);
    if (warehouse) await setMinLevel(itemId, warehouse._id, minLevel);
  }

  await logFromRequest(req, {
    action: 'inventoryItem.update',
    targetType: 'InventoryItem',
    targetId: updated._id,
    summary: `Updated item ${updated.name} (${updated.code})`,
    meta: { changed: Object.keys(req.body ?? {}) },
  });

  res.status(200).json({
    success: true,
    message: 'Item updated successfully',
    data: updated,
  });
};

export const deactivateItem = async (req, res) => {
  const { itemId } = req.params;

  const item = await InventoryItem.findById(itemId);
  if (!item) throw createHttpError(404, 'Item not found');

  item.status = STATUS.DEACTIVATED;
  await item.save();

  await logFromRequest(req, {
    action: 'inventoryItem.delete',
    targetType: 'InventoryItem',
    targetId: item._id,
    summary: `Deactivated item ${item.name} (${item.code})`,
  });

  res.status(200).json({
    success: true,
    message: 'Item deactivated successfully',
    data: item,
  });
};
