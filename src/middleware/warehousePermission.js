import createHttpError from 'http-errors';
import { getSettings } from '../services/systemSettings.js';
import { isDemoMode } from '../constants/demo.js';

// Global kill-switch. While SystemSettings.warehouse.enabled is false the
// whole inventory module is off — every /warehouse route is blocked for
// everyone, admins included, and per-user grants don't matter. Admins
// flip it on from the system-settings page. In the demo the module is
// always on, so the seeded data is reachable without a restart.
export const requireWarehouseEnabled = async (req, res, next) => {
  if (isDemoMode()) return next();
  const settings = await getSettings();
  if (settings?.warehouse?.enabled !== true) {
    throw createHttpError(403, 'Warehouse module is disabled');
  }
  next();
};

// Gate a warehouse route by admin-granted per-user permission flags.
// Admins always pass; any other user needs at least one of the listed
// flags on User.permissions. Role-agnostic on purpose, so a future
// warehouse-keeper is just a user carrying these grants.
export const requireWarehousePermission =
  (...flags) =>
  (req, res, next) => {
    if (!req.user) {
      throw createHttpError(401, 'Authentication required');
    }
    if (req.user.role === 'admin') {
      return next();
    }
    const perms = req.user.permissions ?? {};
    if (flags.some((flag) => perms[flag] === true)) {
      return next();
    }
    throw createHttpError(403, 'Access denied');
  };
