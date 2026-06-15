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
  'slotDurationMinutes',
  'holidays',
  'updatedAt',
];

export const ensureSingleton = async () => {
  const existing = await SystemSettings.findById(SYSTEM_SETTINGS_ID);
  if (existing) {
    if (!existing.timezone) {
      existing.timezone = systemSettingsDefaults.timezone;
      await existing.save();
      console.log(`✅ SystemSettings backfilled timezone='${existing.timezone}'`);
    }
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
