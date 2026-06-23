export const MESSAGE_TYPE = {
  DIRECT: 'direct',
  BROADCAST_ALL: 'broadcast_all',
  BROADCAST_ROLE: 'broadcast_role',
};

export const MESSAGE_TYPES = Object.values(MESSAGE_TYPE);

// Roles allowed to send AND receive direct messages. Operators are
// included so they can report directly to any role (and see replies
// in their inbox) — the same gate guards createDirectMessage and
// listInbox, so adding operator here opens both.
export const DIRECT_SENDER_ROLES = [
  'operator',
  'admin',
  'manager',
  'maintenanceWorker',
  'safety',
];

// Roles a broadcast can target (also valid sender roles for broadcasts).
export const TARGETABLE_ROLES = [
  'operator',
  'admin',
  'manager',
  'maintenanceWorker',
  'safety',
];

export const MESSAGE_TTL_INDEX_NAME = 'message_ttl_expireAt';
