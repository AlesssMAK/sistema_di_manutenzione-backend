import createHttpError from 'http-errors';
import { InventoryItem } from '../models/inventoryItem.js';
import { Unit } from '../models/unit.js';
import { STATUS } from '../constants/status.js';
import { isDemoMode } from '../constants/demo.js';
import { logFromRequest } from '../services/auditLog.js';

export const createItem = async (req, res) => {
  const { code, name, category, unitId, note, status } = req.body;

  if (isDemoMode()) {
    return res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: { _id: 'demo', code, name, category, unitId, note },
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
    category,
    unitId,
    note,
    status,
  });

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

export const getAllItems = async (req, res) => {
  const { search, status, page = 1, perPage = 10 } = req.query;
  const skip = (page - 1) * perPage;

  const query = InventoryItem.find();
  if (status) query.where('status').equals(status);
  if (search) {
    query.where({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ],
    });
  }

  const [totalItems, items] = await Promise.all([
    query.clone().countDocuments(),
    query
      .sort({ name: 1 })
      .skip(skip)
      .limit(perPage)
      .populate('unitId', 'code name'),
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
  const { code, unitId } = req.body;

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

  const updated = await InventoryItem.findByIdAndUpdate(itemId, req.body, {
    new: true,
  }).populate('unitId', 'code name');

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
