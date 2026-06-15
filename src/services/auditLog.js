import { AuditLog, AUDIT_TTL_INDEX_NAME } from '../models/auditLog.js';
import { AUDIT_REDACT_KEYS } from '../constants/auditLog.js';
import { getSettings } from './systemSettings.js';

const MAX_DEPTH = 4;

const redactValue = (value, depth = 0) => {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return '[Truncated]';

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (AUDIT_REDACT_KEYS.has(key)) {
        out[key] = '[Redacted]';
        continue;
      }
      out[key] = redactValue(val, depth + 1);
    }
    return out;
  }

  if (typeof value === 'string' && value.length > 2000) {
    return value.slice(0, 2000) + '…[Truncated]';
  }

  return value;
};

export const redactMeta = (meta) => {
  if (meta == null) return null;
  return redactValue(meta);
};

export const diffShallow = (before, after) => {
  const b = before && typeof before === 'object' ? before : {};
  const a = after && typeof after === 'object' ? after : {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const changed = { before: {}, after: {} };

  for (const key of keys) {
    const beforeVal = b[key];
    const afterVal = a[key];
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      changed.before[key] = beforeVal;
      changed.after[key] = afterVal;
    }
  }
  return changed;
};

export const logEvent = async ({
  actorId = null,
  actorRole = 'system',
  action,
  targetType = null,
  targetId = null,
  summary = '',
  meta = null,
  req = null,
}) => {
  try {
    const entry = {
      actorId,
      actorRole,
      action,
      targetType,
      targetId,
      summary: summary?.toString().slice(0, 500) ?? '',
      meta: redactMeta(meta),
      ip: req?.ip ?? null,
      userAgent: req?.headers?.['user-agent']?.slice(0, 512) ?? null,
    };
    await AuditLog.create(entry);
  } catch (err) {
    console.error('[auditLog] failed to write event', action, err.message);
  }
};

export const logFromRequest = (req, payload) => {
  const actorId = req?.user?._id ?? null;
  const actorRole = req?.user?.role ?? 'system';
  return logEvent({ ...payload, actorId, actorRole, req });
};

export const ensureTtlIndex = async () => {
  const settings = await getSettings();
  const days = settings?.retention?.auditLogDays ?? 90;
  const expireAfterSeconds = days * 24 * 60 * 60;

  const coll = AuditLog.collection;
  // On a fresh DB the collection does not exist yet; Mongo 7 throws
  // NamespaceNotFound from listIndexes. Treat that as "no indexes yet" —
  // createIndex below will create the collection and the TTL index.
  let indexes = [];
  try {
    indexes = await coll.indexes();
  } catch (err) {
    if (err?.codeName !== 'NamespaceNotFound') throw err;
  }
  const existing = indexes.find((i) => i.name === AUDIT_TTL_INDEX_NAME);

  if (existing && existing.expireAfterSeconds !== expireAfterSeconds) {
    await coll.dropIndex(AUDIT_TTL_INDEX_NAME);
  }

  if (!existing || existing.expireAfterSeconds !== expireAfterSeconds) {
    await coll.createIndex(
      { createdAt: 1 },
      { name: AUDIT_TTL_INDEX_NAME, expireAfterSeconds },
    );
    console.log(
      `✅ AuditLog TTL index set to ${days} days (${expireAfterSeconds}s)`,
    );
  }
};
