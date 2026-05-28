import { getSettings } from '../systemSettings.js';

const HOUR_MS = 60 * 60 * 1000;

const recentByRecipient = new Map();

const prune = (timestamps, now) => {
  const cutoff = now - HOUR_MS;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }
};

export const checkAndConsume = async (recipient) => {
  const settings = await getSettings();
  const limit = settings?.email?.rateLimits?.perRecipientPerHour ?? 10;
  if (limit <= 0) return { allowed: false, limit, used: 0 };

  const key = String(recipient).toLowerCase();
  const now = Date.now();
  const timestamps = recentByRecipient.get(key) ?? [];
  prune(timestamps, now);

  if (timestamps.length >= limit) {
    return { allowed: false, limit, used: timestamps.length };
  }

  timestamps.push(now);
  recentByRecipient.set(key, timestamps);
  return { allowed: true, limit, used: timestamps.length };
};

export const resetRateLimiter = () => {
  recentByRecipient.clear();
};
