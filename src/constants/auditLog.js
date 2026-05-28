export const AUDIT_ACTIONS = [
  'auth.login',
  'auth.logout',
  'auth.refresh',
  'auth.register',

  'user.create',
  'user.update',
  'user.delete',
  'user.verify',

  'plant.create',
  'plant.update',
  'plant.delete',

  'part.create',
  'part.update',
  'part.delete',

  'fault.create',
  'fault.update',
  'fault.delete',
  'fault.statusChange',
  'fault.assign',
  'fault.verify',
  'fault.auto_overdue',
  'fault.auto_replanned',

  'comment.create',
  'comment.delete',

  'settings.update',

  'message.create',
  'message.broadcast',
  'message.delete',

  'cron.reschedule',
  'cron.markOverdue',
];

export const AUDIT_TARGETS = [
  'User',
  'Plant',
  'PartPlant',
  'Fault',
  'Comment',
  'SystemSettings',
  'Session',
  'Message',
];

export const AUDIT_ACTOR_ROLES = [
  'operator',
  'admin',
  'manager',
  'maintenanceWorker',
  'safety',
  'system',
];

export const AUDIT_REDACT_KEYS = new Set([
  'password',
  'passwordHash',
  'accessToken',
  'refreshToken',
  'token',
  'tokens',
  'secret',
  'otp',
  'authorization',
  'cookie',
]);
