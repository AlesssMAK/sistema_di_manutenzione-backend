import { Message } from '../models/message.js';
import { MESSAGE_TTL_INDEX_NAME } from '../constants/message.js';

/**
 * Ensure the broadcast TTL index exists. The TTL itself is per-document
 * (we set `expireAt = now + ttlDays` when creating a broadcast), so changing
 * `SystemSettings.messaging.broadcastTtlDays` does NOT require dropping the
 * index — it only affects newly created broadcasts.
 */
export const ensureMessageTtlIndex = async () => {
  const coll = Message.collection;

  // Fresh DB: collection doesn't exist yet → listIndexes throws on Mongo 7.
  // createIndex below creates the collection in the same call.
  let indexes = [];
  try {
    indexes = await coll.indexes();
  } catch (err) {
    if (err?.codeName !== 'NamespaceNotFound') throw err;
  }

  if (indexes.some((i) => i.name === MESSAGE_TTL_INDEX_NAME)) return;

  await coll.createIndex(
    { expireAt: 1 },
    {
      name: MESSAGE_TTL_INDEX_NAME,
      expireAfterSeconds: 0,
      partialFilterExpression: { expireAt: { $type: 'date' } },
    },
  );
  console.log(`✅ Message TTL index ready (${MESSAGE_TTL_INDEX_NAME})`);
};

export const computeBroadcastExpireAt = (broadcastTtlDays) => {
  const days = Number(broadcastTtlDays);
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};
