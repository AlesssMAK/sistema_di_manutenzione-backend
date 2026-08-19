import createHttpError from 'http-errors';
import { Warehouse } from '../models/warehouse.js';
import { STATUS } from '../constants/status.js';
import { isDemoMode } from '../constants/demo.js';
import { logFromRequest } from '../services/auditLog.js';

export const createWarehouse = async (req, res) => {
  const { code, name, location, status } = req.body;

  if (isDemoMode()) {
    return res.status(201).json({
      success: true,
      message: 'Warehouse created successfully',
      data: { _id: 'demo', code, name, location, status: status ?? STATUS.ACTIVE },
    });
  }

  const existing = await Warehouse.findOne({ code });
  if (existing) {
    throw createHttpError(409, `A warehouse with code "${code}" already exists`);
  }

  const warehouse = await Warehouse.create({ code, name, location, status });

  await logFromRequest(req, {
    action: 'warehouse.create',
    targetType: 'Warehouse',
    targetId: warehouse._id,
    summary: `Created warehouse ${warehouse.name} (${warehouse.code})`,
  });

  res.status(201).json({
    success: true,
    message: 'Warehouse created successfully',
    data: warehouse,
  });
};

export const getAllWarehouses = async (req, res) => {
  const { search, status, page = 1, perPage = 10 } = req.query;
  const skip = (page - 1) * perPage;

  const query = Warehouse.find();
  if (status) query.where('status').equals(status);
  if (search) {
    query.where({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ],
    });
  }

  const [totalItems, warehouses] = await Promise.all([
    query.clone().countDocuments(),
    query.sort({ name: 1 }).skip(skip).limit(perPage),
  ]);

  const totalPages = Math.ceil(totalItems / perPage);

  res.status(200).json({
    success: true,
    message: 'Get all warehouses endpoint',
    data: {
      warehouses,
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

export const updateWarehouse = async (req, res) => {
  const { warehouseId } = req.params;
  const { code } = req.body;

  const warehouse = await Warehouse.findById(warehouseId);
  if (!warehouse) throw createHttpError(404, 'Warehouse not found');

  if (code) {
    const clash = await Warehouse.findOne({ _id: { $ne: warehouseId }, code });
    if (clash) {
      throw createHttpError(
        409,
        `A warehouse with code "${code}" already exists`,
      );
    }
  }

  const updated = await Warehouse.findByIdAndUpdate(warehouseId, req.body, {
    new: true,
  });

  await logFromRequest(req, {
    action: 'warehouse.update',
    targetType: 'Warehouse',
    targetId: updated._id,
    summary: `Updated warehouse ${updated.name} (${updated.code})`,
    meta: { changed: Object.keys(req.body ?? {}) },
  });

  res.status(200).json({
    success: true,
    message: 'Warehouse updated successfully',
    data: updated,
  });
};

export const deactivateWarehouse = async (req, res) => {
  const { warehouseId } = req.params;

  const warehouse = await Warehouse.findById(warehouseId);
  if (!warehouse) throw createHttpError(404, 'Warehouse not found');

  warehouse.status = STATUS.DEACTIVATED;
  await warehouse.save();

  await logFromRequest(req, {
    action: 'warehouse.delete',
    targetType: 'Warehouse',
    targetId: warehouse._id,
    summary: `Deactivated warehouse ${warehouse.name} (${warehouse.code})`,
  });

  res.status(200).json({
    success: true,
    message: 'Warehouse deactivated successfully',
    data: warehouse,
  });
};
