import createHttpError from 'http-errors';
import { SystemSettings } from '../models/systemSettings.js';
import { SYSTEM_SETTINGS_ID } from '../constants/systemSettingsDefaults.js';
import {
  getSettings,
  invalidateCache,
  toPublicView,
} from '../services/systemSettings.js';
import {
  ensureTtlIndex as ensureAuditTtlIndex,
  logFromRequest,
  redactMeta,
} from '../services/auditLog.js';
import { reloadCronJobs } from '../cron/index.js';
import { ensureDefaultWarehouse } from '../services/warehouseContext.js';

export const getPublicSettings = async (req, res) => {
  const settings = await getSettings();
  return res.status(200).json(toPublicView(settings));
};

export const getFullSettings = async (req, res) => {
  const settings = await getSettings();
  return res.status(200).json(settings);
};

export const updateSettings = async (req, res) => {
  const update = { ...req.body, updatedBy: req.user._id };

  const updated = await SystemSettings.findByIdAndUpdate(
    SYSTEM_SETTINGS_ID,
    { $set: update },
    { new: true, runValidators: true },
  );

  if (!updated) {
    throw createHttpError(404, 'SystemSettings singleton not initialised');
  }

  invalidateCache();

  if (req.body?.retention?.auditLogDays !== undefined) {
    ensureAuditTtlIndex().catch((err) =>
      console.error('[auditLog] ensureTtlIndex after settings update failed', err.message),
    );
  }

  if (req.body?.timezone !== undefined) {
    reloadCronJobs().catch((err) =>
      console.error('[cron] reload after settings update failed', err.message),
    );
  }

  // Enabling the warehouse module with no warehouses yet would leave
  // single-warehouse mode with nothing to resolve to; seed a default one
  // so the module works out of the box.
  if (req.body?.warehouse?.enabled === true) {
    ensureDefaultWarehouse().catch((err) =>
      console.error('[warehouse] ensureDefaultWarehouse failed', err.message),
    );
  }

  await logFromRequest(req, {
    action: 'settings.update',
    targetType: 'SystemSettings',
    targetId: updated._id,
    summary: `Settings updated (${Object.keys(req.body ?? {}).join(', ')})`,
    meta: redactMeta(req.body),
  });

  return res.status(200).json(updated);
};
