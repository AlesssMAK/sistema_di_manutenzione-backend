import { Warehouse } from '../models/warehouse.js';
import { StockLevel } from '../models/stockLevel.js';
import { STATUS } from '../constants/status.js';
import { getSettings } from './systemSettings.js';

// Warehouse-selection is contextual: the picker is shown only when a
// context has more than one candidate warehouse. These helpers resolve
// the candidate set for each context so both the API and the UI agree on
// when a warehouse must be chosen vs. can be filled implicitly.
//
// The multiWarehouse flag is the master gate: while it is OFF the shop
// runs on ONE warehouse and every context collapses to the default
// warehouse (no picker anywhere). Only when it is ON do per-user
// (operations) and per-role (faults) rules widen the sets.

const isMulti = (settings) => settings?.warehouse?.multiWarehouse === true;

// The single warehouse used when the choice is implicit: the explicit
// defaultWarehouseId when set & active, else the sole active warehouse,
// else the first active by code (deterministic). null when none exist.
export const getEffectiveDefaultWarehouse = async () => {
  const settings = await getSettings();
  const defId = settings?.warehouse?.defaultWarehouseId;
  if (defId) {
    const chosen = await Warehouse.findOne({
      _id: defId,
      status: STATUS.ACTIVE,
    })
      .select('_id code name')
      .lean();
    if (chosen) return chosen;
  }
  const active = await Warehouse.find({ status: STATUS.ACTIVE })
    .select('_id code name')
    .sort({ code: 1 })
    .lean();
  return active[0] ?? null;
};

// Keeper context (Carico / Giacenze / transfer / catalog). Single mode →
// just the default warehouse. Multi mode → every active warehouse
// narrowed by the user's allowedWarehouses (admins/unrestricted = all).
export const getManagementCandidates = async (user) => {
  const settings = await getSettings();
  if (!isMulti(settings)) {
    const def = await getEffectiveDefaultWarehouse();
    return def ? [def] : [];
  }
  const all = await Warehouse.find({ status: STATUS.ACTIVE })
    .select('_id code name')
    .lean();
  const allowed = user?.allowedWarehouses ?? [];
  if (user?.role === 'admin' || allowed.length === 0) return all;
  const allowSet = new Set(allowed.map(String));
  return all.filter((w) => allowSet.has(String(w._id)));
};

// Fault/maintenance context (issuing parts for a fault). Single mode →
// the default warehouse. Multi mode → the warehouses assigned to the
// user's ROLE for fault work; when the role has none configured, fall
// back to the default warehouse. Never "all", and never widened by
// keeper rights — a keeper who is also a technician still only draws
// fault parts from his role's warehouses.
export const getMaintenanceCandidates = async (user) => {
  const settings = await getSettings();
  if (!isMulti(settings)) {
    const def = await getEffectiveDefaultWarehouse();
    return def ? [def] : [];
  }
  const byRole = settings?.warehouse?.faultWarehousesByRole ?? [];
  const entry = byRole.find((e) => e.role === user?.role);
  const ids = entry?.warehouseIds ?? [];
  if (ids.length === 0) {
    const def = await getEffectiveDefaultWarehouse();
    return def ? [def] : [];
  }
  return Warehouse.find({ _id: { $in: ids }, status: STATUS.ACTIVE })
    .select('_id code name')
    .lean();
};

// The effective warehouse for a context that carries no explicit choice.
// A single candidate is unambiguous; with several, honour an explicit
// defaultWarehouseId when it is one of the candidates; otherwise the
// caller must have the user pick one (null).
export const resolveEffectiveWarehouse = (candidates, defaultWarehouseId = null) => {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  if (defaultWarehouseId) {
    const match = candidates.find(
      (w) => String(w._id) === String(defaultWarehouseId),
    );
    if (match) return match;
  }
  return null;
};

// The effective management warehouse for a user, or null when the choice
// is ambiguous (several candidates and no usable default). Used where a
// warehouse is implied rather than picked — e.g. setting a minimum from
// the item form in the single-warehouse case.
export const resolveManagementWarehouse = async (user) => {
  const candidates = await getManagementCandidates(user);
  const settings = await getSettings();
  return resolveEffectiveWarehouse(
    candidates,
    settings?.warehouse?.defaultWarehouseId,
  );
};

// Ensure the module has at least one warehouse so single-warehouse mode
// works out of the box. Called when the module is enabled; a no-op once
// any active warehouse exists. Returns the created warehouse or null.
export const ensureDefaultWarehouse = async () => {
  const count = await Warehouse.countDocuments({ status: STATUS.ACTIVE });
  if (count > 0) return null;
  const created = await Warehouse.create({
    code: 'MAG-01',
    name: 'Magazzino',
    status: STATUS.ACTIVE,
  });
  return created;
};

// Read the reorder point for an (item x warehouse) pair, creating the
// stock line at quantity 0 when it does not exist yet. Used to set a
// minimum before any movement has materialised the level.
export const setMinLevel = async (itemId, warehouseId, minLevel) => {
  const level = await StockLevel.findOneAndUpdate(
    { itemId, warehouseId },
    { $set: { minLevel }, $setOnInsert: { quantity: 0 } },
    { new: true, upsert: true },
  );
  return level;
};
