import createHttpError from 'http-errors';
import { Unit } from '../models/unit.js';
import { InventoryItem } from '../models/inventoryItem.js';
import { STATUS } from '../constants/status.js';
import { isDemoMode } from '../constants/demo.js';
import { logFromRequest } from '../services/auditLog.js';

export const createUnit = async (req, res) => {
  const { code, name, status } = req.body;

  if (isDemoMode()) {
    return res.status(201).json({
      success: true,
      message: 'Unit created successfully',
      data: { _id: 'demo', code, name, status: status ?? STATUS.ACTIVE },
    });
  }

  const existing = await Unit.findOne({ code });
  if (existing) {
    throw createHttpError(409, `A unit with code "${code}" already exists`);
  }

  const unit = await Unit.create({ code, name, status });

  await logFromRequest(req, {
    action: 'unit.create',
    targetType: 'Unit',
    targetId: unit._id,
    summary: `Created unit ${unit.name} (${unit.code})`,
  });

  res.status(201).json({
    success: true,
    message: 'Unit created successfully',
    data: unit,
  });
};

export const getAllUnits = async (req, res) => {
  const { search, status, page = 1, perPage = 10 } = req.query;
  const skip = (page - 1) * perPage;

  const query = Unit.find();
  if (status) query.where('status').equals(status);
  if (search) {
    query.where({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ],
    });
  }

  const [totalItems, units] = await Promise.all([
    query.clone().countDocuments(),
    query.sort({ name: 1 }).skip(skip).limit(perPage),
  ]);

  const totalPages = Math.ceil(totalItems / perPage);

  res.status(200).json({
    success: true,
    message: 'Get all units endpoint',
    data: {
      units,
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

export const updateUnit = async (req, res) => {
  const { unitId } = req.params;
  const { code } = req.body;

  const unit = await Unit.findById(unitId);
  if (!unit) throw createHttpError(404, 'Unit not found');

  if (code) {
    const clash = await Unit.findOne({ _id: { $ne: unitId }, code });
    if (clash) {
      throw createHttpError(409, `A unit with code "${code}" already exists`);
    }
  }

  const updated = await Unit.findByIdAndUpdate(unitId, req.body, { new: true });

  await logFromRequest(req, {
    action: 'unit.update',
    targetType: 'Unit',
    targetId: updated._id,
    summary: `Updated unit ${updated.name} (${updated.code})`,
    meta: { changed: Object.keys(req.body ?? {}) },
  });

  res.status(200).json({
    success: true,
    message: 'Unit updated successfully',
    data: updated,
  });
};

export const deactivateUnit = async (req, res) => {
  const { unitId } = req.params;

  const unit = await Unit.findById(unitId);
  if (!unit) throw createHttpError(404, 'Unit not found');

  // Block deactivating a unit still referenced by active items, so
  // catalog rows never end up pointing at a dead unit of measure.
  const inUse = await InventoryItem.countDocuments({
    unitId,
    status: STATUS.ACTIVE,
  });
  if (inUse > 0) {
    throw createHttpError(
      409,
      `Unit is used by ${inUse} active item(s) and cannot be deactivated`,
    );
  }

  unit.status = STATUS.DEACTIVATED;
  await unit.save();

  await logFromRequest(req, {
    action: 'unit.delete',
    targetType: 'Unit',
    targetId: unit._id,
    summary: `Deactivated unit ${unit.name} (${unit.code})`,
  });

  res.status(200).json({
    success: true,
    message: 'Unit deactivated successfully',
    data: unit,
  });
};
