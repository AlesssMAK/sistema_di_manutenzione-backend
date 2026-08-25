import createHttpError from 'http-errors';
import { Category } from '../models/category.js';
import { InventoryItem } from '../models/inventoryItem.js';
import { STATUS } from '../constants/status.js';
import { isDemoMode } from '../constants/demo.js';
import { logFromRequest } from '../services/auditLog.js';

export const createCategory = async (req, res) => {
  const { name, status } = req.body;

  if (isDemoMode()) {
    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { _id: 'demo', name, status: status ?? STATUS.ACTIVE },
    });
  }

  const existing = await Category.findOne({ name });
  if (existing) {
    throw createHttpError(409, `A category named "${name}" already exists`);
  }

  const category = await Category.create({ name, status });

  await logFromRequest(req, {
    action: 'category.create',
    targetType: 'Category',
    targetId: category._id,
    summary: `Created category ${category.name}`,
  });

  res.status(201).json({
    success: true,
    message: 'Category created successfully',
    data: category,
  });
};

export const getAllCategories = async (req, res) => {
  const { search, status, page = 1, perPage = 10 } = req.query;
  const skip = (page - 1) * perPage;

  const query = Category.find();
  if (status) query.where('status').equals(status);
  if (search) {
    query.where({ name: { $regex: search, $options: 'i' } });
  }

  const [totalItems, categories] = await Promise.all([
    query.clone().countDocuments(),
    query.sort({ name: 1 }).skip(skip).limit(perPage),
  ]);

  const totalPages = Math.ceil(totalItems / perPage);

  res.status(200).json({
    success: true,
    message: 'Get all categories endpoint',
    data: {
      categories,
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

export const updateCategory = async (req, res) => {
  const { categoryId } = req.params;
  const { name } = req.body;

  const category = await Category.findById(categoryId);
  if (!category) throw createHttpError(404, 'Category not found');

  if (name) {
    const clash = await Category.findOne({ _id: { $ne: categoryId }, name });
    if (clash) {
      throw createHttpError(409, `A category named "${name}" already exists`);
    }
  }

  const updated = await Category.findByIdAndUpdate(categoryId, req.body, {
    new: true,
  });

  await logFromRequest(req, {
    action: 'category.update',
    targetType: 'Category',
    targetId: updated._id,
    summary: `Updated category ${updated.name}`,
    meta: { changed: Object.keys(req.body ?? {}) },
  });

  res.status(200).json({
    success: true,
    message: 'Category updated successfully',
    data: updated,
  });
};

export const deactivateCategory = async (req, res) => {
  const { categoryId } = req.params;

  const category = await Category.findById(categoryId);
  if (!category) throw createHttpError(404, 'Category not found');

  // Block deactivating a category still used by active items, so catalog
  // rows never point at a dead category.
  const inUse = await InventoryItem.countDocuments({
    categoryId,
    status: STATUS.ACTIVE,
  });
  if (inUse > 0) {
    throw createHttpError(
      409,
      `Category is used by ${inUse} active item(s) and cannot be deactivated`,
    );
  }

  category.status = STATUS.DEACTIVATED;
  await category.save();

  await logFromRequest(req, {
    action: 'category.delete',
    targetType: 'Category',
    targetId: category._id,
    summary: `Deactivated category ${category.name}`,
  });

  res.status(200).json({
    success: true,
    message: 'Category deactivated successfully',
    data: category,
  });
};
