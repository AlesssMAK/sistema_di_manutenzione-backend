import mongoose from 'mongoose';
import createHttpError from 'http-errors';
import { StockLevel } from '../models/stockLevel.js';
import { StockMovement } from '../models/stockMovement.js';
import { InventoryItem } from '../models/inventoryItem.js';
import { Warehouse } from '../models/warehouse.js';
import { Fault } from '../models/fault.js';
import { MOVEMENT_TYPE, REFERENCE_TYPE } from '../constants/warehouse.js';
import { STATUS } from '../constants/status.js';
import { logFromRequest } from '../services/auditLog.js';
import { isLowForAlert, notifyLowStock } from '../services/warehouseAlerts.js';
import { getSettings } from '../services/systemSettings.js';
import {
  getManagementCandidates,
  getMaintenanceCandidates,
  resolveEffectiveWarehouse,
  setMinLevel,
} from '../services/warehouseContext.js';

const ensureWarehouse = async (warehouseId) => {
  const warehouse = await Warehouse.findById(warehouseId);
  if (!warehouse || warehouse.status !== STATUS.ACTIVE) {
    throw createHttpError(400, 'Invalid or inactive warehouse');
  }
  return warehouse;
};

// Resolve the warehouse for a movement, from the candidate set of a
// context. `context` is 'maintenance' (the fault set: single mode → the
// default warehouse, multi mode → the user's role fault warehouses) or
// 'management' (the keeper set: single mode → the default warehouse,
// multi mode → active warehouses narrowed by allowedWarehouses; admins
// unrestricted). A provided id must belong to that set (403 otherwise —
// this also enforces per-user/role access). When omitted, the effective
// warehouse is used if unambiguous (single candidate); otherwise the
// caller must pick one (400).
const resolveMovementWarehouseId = async (user, provided, context) => {
  const candidates =
    context === 'maintenance'
      ? await getMaintenanceCandidates(user)
      : await getManagementCandidates(user);
  if (provided) {
    const ok = candidates.some((w) => String(w._id) === String(provided));
    if (!ok) {
      throw createHttpError(403, 'Warehouse not available in this context');
    }
    return String(provided);
  }
  const settings = await getSettings();
  const effective = resolveEffectiveWarehouse(
    candidates,
    settings?.warehouse?.defaultWarehouseId,
  );
  if (!effective) {
    throw createHttpError(400, 'A warehouse must be selected');
  }
  return String(effective._id);
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
    categoryId,
    search,
    lowOnly = false,
    page = 1,
    perPage = 20,
  } = req.query;
  const skip = (page - 1) * perPage;

  const filter = {};
  if (warehouseId) filter.warehouseId = warehouseId;
  if (itemId) filter.itemId = itemId;

  // Narrow by item attributes (category and/or text) → resolve to the
  // matching item ids. Skipped when a specific itemId is already given.
  if (!itemId && (categoryId || search)) {
    const itemFilter = {};
    if (categoryId) itemFilter.categoryId = categoryId;
    if (search) {
      itemFilter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }
    const matched = await InventoryItem.find(itemFilter).select('_id');
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
        select:
          'code name categoryId unitId packageLabel unitsPerPackage status',
        populate: [
          { path: 'unitId', select: 'code name allowsDecimals' },
          { path: 'categoryId', select: 'name' },
        ],
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
  const { lines, note } = req.body;
  const warehouseId = await resolveMovementWarehouseId(
    req.user,
    req.body.warehouseId,
    'management',
  );
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
  const { lines, reference, note } = req.body;
  const ref = reference ?? { type: REFERENCE_TYPE.NONE };
  // A fault write-off draws from the maintenance set; any other issue
  // (task/none) is a keeper operation over the management set.
  const context =
    ref.type === REFERENCE_TYPE.FAULT ? 'maintenance' : 'management';

  // Issuing stock is a warehouse-operate action — EXCEPT a fault
  // write-off, which any technician assigned to that fault may do (the
  // warehouse itself is still restricted to their fault set by
  // resolveMovementWarehouseId below). This is the "materials are part
  // of the maintenance job" split from warehouse management.
  const perms = req.user.permissions ?? {};
  const canOperate =
    req.user.role === 'admin' || perms.canOperateWarehouse === true;
  if (!canOperate) {
    const isFaultWriteOff = ref.type === REFERENCE_TYPE.FAULT && ref.faultId;
    const assigned =
      isFaultWriteOff &&
      (await Fault.exists({
        _id: ref.faultId,
        assignedMaintainers: req.user._id,
      }));
    if (!assigned) {
      throw createHttpError(403, 'Not allowed to issue stock');
    }
  }

  const warehouseId = await resolveMovementWarehouseId(
    req.user,
    req.body.warehouseId,
    context,
  );
  const warehouse = await ensureWarehouse(warehouseId);
  const itemsById = await loadItems(lines);
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
  const { itemId, quantity, note } = req.body;
  const warehouseId = await resolveMovementWarehouseId(
    req.user,
    req.body.warehouseId,
    'management',
  );
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
  const { lines, note } = req.body;
  const fromWarehouseId = await resolveMovementWarehouseId(
    req.user,
    req.body.fromWarehouseId,
    'management',
  );
  const toWarehouseId = await resolveMovementWarehouseId(
    req.user,
    req.body.toWarehouseId,
    'management',
  );
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

// Set the reorder point (minLevel) for an (item x warehouse) pair. Used
// by the Giacenze inline editor and, in the single-warehouse case, from
// the item form. warehouseId is optional: when omitted the effective
// management warehouse is used. Creates the stock line at quantity 0 if
// it does not exist yet, so a minimum can be set before any movement.
export const stockSetMin = async (req, res) => {
  const { itemId, minLevel } = req.body;
  const warehouseId = await resolveMovementWarehouseId(
    req.user,
    req.body.warehouseId,
    'management',
  );
  const item = await InventoryItem.findById(itemId);
  if (!item) throw createHttpError(400, 'Item does not exist');
  await ensureWarehouse(warehouseId);

  const level = await setMinLevel(itemId, warehouseId, minLevel);

  await logFromRequest(req, {
    action: 'stock.setMin',
    targetType: 'InventoryItem',
    targetId: itemId,
    summary: `Set minimum of ${item.name} to ${minLevel}`,
    meta: { warehouseId, minLevel },
  });

  res.status(200).json({
    success: true,
    message: 'Minimum level updated',
    data: {
      itemId,
      warehouseId,
      minLevel: level.minLevel,
      quantity: level.quantity,
      low: level.quantity <= level.minLevel,
    },
  });
};

// Movement history, newest first. Filterable by item, warehouse, fault
// or movement type.
export const getMovements = async (req, res) => {
  const {
    itemId,
    warehouseId,
    faultId,
    type,
    dateFrom,
    dateTo,
    page = 1,
    perPage = 20,
  } = req.query;
  const skip = (page - 1) * perPage;

  const filter = {};
  if (itemId) filter.itemId = itemId;
  if (warehouseId) filter.warehouseId = warehouseId;
  if (faultId) filter['reference.faultId'] = faultId;
  if (type) filter.type = type;
  // Date range over the movement timestamp ('YYYY-MM-DD'); the upper
  // bound covers the whole day.
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

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
