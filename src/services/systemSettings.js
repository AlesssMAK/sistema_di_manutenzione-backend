import { SystemSettings } from '../models/systemSettings.js';
import {
  SYSTEM_SETTINGS_ID,
  systemSettingsDefaults,
} from '../constants/systemSettingsDefaults.js';

let cached = null;

const PUBLIC_FIELDS = [
  '_id',
  'timezone',
  'workHours',
  'workDays',
  'weekSchedule',
  'slotDurationMinutes',
  'holidays',
  'updatedAt',
];

const CRON_TO_DAY_KEY = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

export const ensureSingleton = async () => {
  const existing = await SystemSettings.findById(SYSTEM_SETTINGS_ID);
  if (existing) {
    let dirty = false;

    if (!existing.timezone) {
      existing.timezone = systemSettingsDefaults.timezone;
      dirty = true;
      console.log(`✅ SystemSettings backfilled timezone='${existing.timezone}'`);
    }

    // Backfill email triggers that were added to the model after
    // the singleton document was first created. Without this, fresh
    // schema fields stay undefined for existing deployments and
    // guard() blocks the corresponding emails (onSuspended was the
    // visible case; onReassign would have the same fate).
    if (!existing.email) existing.email = {};
    if (!existing.email.triggers) existing.email.triggers = {};
    const defaultTriggers = systemSettingsDefaults.email.triggers ?? {};
    for (const [key, value] of Object.entries(defaultTriggers)) {
      if (existing.email.triggers[key] === undefined) {
        existing.email.triggers[key] = value;
        dirty = true;
        console.log(`✅ SystemSettings backfilled email.triggers.${key}=${value}`);
      }
    }

    // Backfill the per-day schedule for documents created before
    // weekSchedule existed — derived from the legacy workDays/workHours.
    if (!existing.weekSchedule?.mon) {
      const start = existing.workHours?.start ?? '08:00';
      const end = existing.workHours?.end ?? '17:00';
      const workDays = existing.workDays ?? [];
      const built = {};
      for (const [cron, key] of Object.entries(CRON_TO_DAY_KEY)) {
        built[key] = { enabled: workDays.includes(Number(cron)), start, end };
      }
      existing.weekSchedule = built;
      dirty = true;
      console.log('✅ SystemSettings backfilled weekSchedule');
    }

    // Build the per-day weekSchedule from the legacy workDays/workHours
    // for documents created before that field existed.
    if (!existing.weekSchedule?.mon) {
      const wd = existing.workDays ?? [1, 2, 3, 4, 5];
      const start = existing.workHours?.start ?? '08:00';
      const end = existing.workHours?.end ?? '17:00';
      const built = {};
      for (const [cron, key] of Object.entries(CRON_TO_DAY_KEY)) {
        built[key] = { enabled: wd.includes(Number(cron)), start, end };
      }
      existing.weekSchedule = built;
      dirty = true;
      console.log('✅ SystemSettings backfilled weekSchedule');
    }

    if (dirty) await existing.save();
    cached = existing.toObject();
    console.log('✅ SystemSettings loaded');
    return cached;
  }

  const created = await SystemSettings.create({
    _id: SYSTEM_SETTINGS_ID,
    ...systemSettingsDefaults,
  });
  cached = created.toObject();
  console.log('✅ SystemSettings bootstrapped with defaults');
  return cached;
};

export const getSettings = async () => {
  if (cached) return cached;
  const doc = await SystemSettings.findById(SYSTEM_SETTINGS_ID).lean();
  if (!doc) return ensureSingleton();
  cached = doc;
  return cached;
};

export const invalidateCache = () => {
  cached = null;
};

export const toPublicView = (settings) => {
  const view = {};
  for (const key of PUBLIC_FIELDS) {
    if (settings[key] !== undefined) view[key] = settings[key];
  }
  return view;
};
