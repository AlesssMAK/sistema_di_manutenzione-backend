import mongoose from 'mongoose';
import createHttpError from 'http-errors';
import { StockLevel } from '../models/stockLevel.js';
import { StockMovement } from '../models/stockMovement.js';
import { InventoryItem } from '../models/inventoryItem.js';
import { Warehouse } from '../models/warehouse.js';
import { MOVEMENT_TYPE, REFERENCE_TYPE } from '../constants/warehouse.js';
import { STATUS } from '../constants/status.js';
import { logFromRequest } from '../services/auditLog.js';
import { isLowForAlert, notifyLowStock } from '../services/warehouseAlerts.js';

const ensureWarehouse = async (warehouseId) => {
  const warehouse = await Warehouse.findById(warehouseId);
  if (!warehouse || warehouse.status !== STATUS.ACTIVE) {
    throw createHttpError(400, 'Invalid or inactive warehouse');
  }
  return warehouse;
};

const loadItems = async (lines) => {
  const ids = [...new Set(lines.map((l) => String(l.itemId)))];
  const items = await InventoryItem.find({ _id: { $in: ids } });
  if (items.length !== ids.length) {
    throw createHttpError(400, 'One or more items do not exist');
  }
  return new Map(items.map((it) => [String(it._id), it]));
};

// Read the on-hand levels for a warehouse (or a single item across all
// warehouses). `lowOnly` keeps only rows at/below their reorder point.
export const getStock = async (req, res) => {
  const {
    warehouseId,
    itemId,
    search,
    lowOnly = false,
    page = 1,
    perPage = 20,
  } = req.query;
  const skip = (page - 1) * perPage;

  const filter = {};
  if (warehouseId) filter.warehouseId = warehouseId;
  if (itemId) filter.itemId = itemId;

  if (search) {
    const matched = await InventoryItem.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ],
    }).select('_id');
    filter.itemId = { $in: matched.map((m) => m._id) };
  }

  if (lowOnly) {
    filter.$expr = { $lte: ['$quantity', '$minLevel'] };
  }

  const base = StockLevel.find(filter);
  const [totalItems, levels] = await Promise.all([
    StockLevel.countDocuments(filter),
    base
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(perPage)
      .populate({
        path: 'itemId',
        select: 'code name category unitId packageLabel unitsPerPackage status',
        populate: { path: 'unitId', select: 'code name allowsDecimals' },
      })
      .populate('warehouseId', 'code name'),
  ]);

  const totalPages = Math.ceil(totalItems / perPage);

  res.status(200).json({
    success: true,
    message: 'Get stock levels endpoint',
    data: {
      levels,
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

// Receive goods: one movement per line, all sharing a batchId, each
// adding to the (item x warehouse) on-hand level.
export const stockIn = async (req, res) => {
  const { warehouseId, lines, note } = req.body;
  await ensureWarehouse(warehouseId);
  const itemsById = await loadItems(lines);

  const batchId = new mongoose.Types.ObjectId();
  const results = [];

  for (const line of lines) {
    const level = await StockLevel.findOneAndUpdate(
      { itemId: line.itemId, warehouseId },
      { $inc: { quantity: line.quantity }, $setOnInsert: { minLevel: 0 } },
      { new: true, upsert: true },
    );

    await StockMovement.create({
      itemId: line.itemId,
      warehouseId,
      type: MOVEMENT_TYPE.IN,
      quantity: line.quantity,
      userId: req.user._id,
      userName: req.user.fullName,
      note,
      batchId,
    });

    results.push({
      itemId: line.itemId,
      name: itemsById.get(String(line.itemId))?.name,
      quantity: level.quantity,
    });
  }

  await logFromRequest(req, {
    action: 'stock.in',
    targetType: 'Warehouse',
    targetId: warehouseId,
    summary: `Received ${lines.length} line(s) into warehouse`,
    meta: { batchId, lines: lines.length },
  });

  res.status(201).json({
    success: true,
    message: 'Stock received successfully',
    data: { batchId, results },
  });
};

// Issue/consume goods: one movement per line sharing a batchId, tied to
// an optional reference (fault / task / none). Issuing more than on-hand
// is allowed; affected lines that drop to/below minLevel (or negative)
// come back as warnings.
export const stockOut = async (req, res) => {
  const { warehouseId, lines, reference, note } = req.body;
  const warehouse = await ensureWarehouse(warehouseId);
  const itemsById = await loadItems(lines);

  const ref = reference ?? { type: REFERENCE_TYPE.NONE };
  const batchId = new mongoose.Types.ObjectId();
  const results = [];
  const warnings = [];

  for (const line of lines) {
    const level = await StockLevel.findOneAndUpdate(
      { itemId: line.itemId, warehouseId },
      { $inc: { quantity: -line.quantity }, $setOnInsert: { minLevel: 0 } },
      { new: true, upsert: true },
    );

    await StockMovement.create({
      itemId: line.itemId,
      warehouseId,
      type: MOVEMENT_TYPE.OUT,
      quantity: line.quantity,
      userId: req.user._id,
      userName: req.user.fullName,
      reference: ref,
      note,
      batchId,
    });

    const name = itemsById.get(String(line.itemId))?.name;
    results.push({ itemId: line.itemId, name, quantity: level.quantity });

    if (level.quantity < 0 || level.quantity <= level.minLevel) {
      warnings.push({
        itemId: line.itemId,
        name,
        quantity: level.quantity,
        minLevel: level.minLevel,
        negative: level.quantity < 0,
      });
    }
  }

  await logFromRequest(req, {
    action: 'stock.out',
    targetType: 'Warehouse',
    targetId: warehouseId,
    summary: `Issued ${lines.length} line(s) from warehouse`,
    meta: { batchId, lines: lines.length, reference: ref },
  });

  // Fire-and-forget low-stock alert for items that crossed the reorder
  // point (or went negative).
  const lowItems = warnings.filter((w) => isLowForAlert(w.quantity, w.minLevel));
  notifyLowStock(lowItems, warehouse);

  res.status(201).json({
    success: true,
    message: 'Stock issued successfully',
    data: { batchId, results, warnings },
  });
};

// Inventory correction: sets the (item x warehouse) level to a counted
// value. The movement stores the counted absolute quantity.
export const stockAdjust = async (req, res) => {
  const { warehouseId, itemId, quantity, note } = req.body;
  const warehouse = await ensureWarehouse(warehouseId);

  const item = await InventoryItem.findById(itemId);
  if (!item) throw createHttpError(400, 'Item does not exist');

  const current = await StockLevel.findOne({ itemId, warehouseId });
  const previous = current?.quantity ?? 0;

  const level = await StockLevel.findOneAndUpdate(
    { itemId, warehouseId },
    { $set: { quantity }, $setOnInsert: { minLevel: 0 } },
    { new: true, upsert: true },
  );

  await StockMovement.create({
    itemId,
    warehouseId,
    type: MOVEMENT_TYPE.ADJUST,
    quantity,
    userId: req.user._id,
    userName: req.user.fullName,
    note,
  });

  await logFromRequest(req, {
    action: 'stock.adjust',
    targetType: 'InventoryItem',
    targetId: itemId,
    summary: `Adjusted ${item.name} from ${previous} to ${quantity}`,
    meta: { warehouseId, previous, quantity },
  });

  if (isLowForAlert(level.quantity, level.minLevel)) {
    notifyLowStock(
      [
        {
          itemId,
          name: item.name,
          quantity: level.quantity,
          minLevel: level.minLevel,
          negative: level.quantity < 0,
        },
      ],
      warehouse,
    );
  }

  res.status(200).json({
    success: true,
    message: 'Stock adjusted successfully',
    data: {
      itemId,
      warehouseId,
      previous,
      quantity: level.quantity,
      low: level.quantity <= level.minLevel,
    },
  });
};

// Move stock between two warehouses: for each line an OUT from the
// source and an IN to the destination, sharing a batchId and tagged as
// a transfer (label = counterpart warehouse). Issuing more than on-hand
// at the source is allowed; low/negative source lines come back as
// warnings.
export const stockTransfer = async (req, res) => {
  const { fromWarehouseId, toWarehouseId, lines, note } = req.body;
  if (String(fromWarehouseId) === String(toWarehouseId)) {
    throw createHttpError(400, 'Source and destination must differ');
  }
  const [fromWarehouse, toWarehouse] = await Promise.all([
    ensureWarehouse(fromWarehouseId),
    ensureWarehouse(toWarehouseId),
  ]);
  const itemsById = await loadItems(lines);

  const batchId = new mongoose.Types.ObjectId();
  const results = [];
  const warnings = [];

  for (const line of lines) {
    const fromLevel = await StockLevel.findOneAndUpdate(
      { itemId: line.itemId, warehouseId: fromWarehouseId },
      { $inc: { quantity: -line.quantity }, $setOnInsert: { minLevel: 0 } },
      { new: true, upsert: true },
    );
    const toLevel = await StockLevel.findOneAndUpdate(
      { itemId: line.itemId, warehouseId: toWarehouseId },
      { $inc: { quantity: line.quantity }, $setOnInsert: { minLevel: 0 } },
      { new: true, upsert: true },
    );

    await StockMovement.create([
      {
        itemId: line.itemId,
        warehouseId: fromWarehouseId,
        type: MOVEMENT_TYPE.OUT,
        quantity: line.quantity,
        userId: req.user._id,
        userName: req.user.fullName,
        reference: { type: REFERENCE_TYPE.TRANSFER, label: toWarehouse.name },
        note,
        batchId,
      },
      {
        itemId: line.itemId,
        warehouseId: toWarehouseId,
        type: MOVEMENT_TYPE.IN,
        quantity: line.quantity,
        userId: req.user._id,
        userName: req.user.fullName,
        reference: { type: REFERENCE_TYPE.TRANSFER, label: fromWarehouse.name },
        note,
        batchId,
      },
    ]);

    const name = itemsById.get(String(line.itemId))?.name;
    results.push({
      itemId: line.itemId,
      name,
      from: fromLevel.quantity,
      to: toLevel.quantity,
    });

    if (fromLevel.quantity < 0 || fromLevel.quantity <= fromLevel.minLevel) {
      warnings.push({
        itemId: line.itemId,
        name,
        quantity: fromLevel.quantity,
        minLevel: fromLevel.minLevel,
        negative: fromLevel.quantity < 0,
      });
    }
  }

  await logFromRequest(req, {
    action: 'stock.transfer',
    targetType: 'Warehouse',
    targetId: fromWarehouseId,
    summary: `Transferred ${lines.length} line(s) from ${fromWarehouse.name} to ${toWarehouse.name}`,
    meta: { batchId, lines: lines.length, toWarehouseId },
  });

  const lowItems = warnings.filter((w) => isLowForAlert(w.quantity, w.minLevel));
  notifyLowStock(lowItems, fromWarehouse);

  res.status(201).json({
    success: true,
    message: 'Stock transferred successfully',
    data: { batchId, results, warnings },
  });
};

// Movement history, newest first. Filterable by item, warehouse, fault
// or movement type.
export const getMovements = async (req, res) => {
  const { itemId, warehouseId, faultId, type, page = 1, perPage = 20 } =
    req.query;
  const skip = (page - 1) * perPage;

  const filter = {};
  if (itemId) filter.itemId = itemId;
  if (warehouseId) filter.warehouseId = warehouseId;
  if (faultId) filter['reference.faultId'] = faultId;
  if (type) filter.type = type;

  const [totalItems, movements] = await Promise.all([
    StockMovement.countDocuments(filter),
    StockMovement.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .populate({
        path: 'itemId',
        select: 'code name unitId',
        populate: { path: 'unitId', select: 'code name' },
      })
      .populate('warehouseId', 'code name'),
  ]);

  const totalPages = Math.ceil(totalItems / perPage);

  res.status(200).json({
    success: true,
    message: 'Get stock movements endpoint',
    data: {
      movements,
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
