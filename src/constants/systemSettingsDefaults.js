export const SYSTEM_SETTINGS_ID = 'global';

export const systemSettingsDefaults = {
  timezone: 'Europe/Rome',
  workHours: {
    start: '08:00',
    end: '17:00',
  },
  workDays: [1, 2, 3, 4, 5],
  weekSchedule: {
    mon: { enabled: true, start: '08:00', end: '17:00' },
    tue: { enabled: true, start: '08:00', end: '17:00' },
    wed: { enabled: true, start: '08:00', end: '17:00' },
    thu: { enabled: true, start: '08:00', end: '17:00' },
    fri: { enabled: true, start: '08:00', end: '17:00' },
    sat: { enabled: false, start: '08:00', end: '12:00' },
    sun: { enabled: false, start: '08:00', end: '17:00' },
  },
  slotDurationMinutes: 30,
  holidays: [],

  email: {
    enabled: true,
    from: 'noreply@mms.local',
    triggers: {
      onAssignment: true,
      onNewFault: true,
      onSicurezzaHse: true,
      onDirectMessage: true,
      onSuspended: true,
    },
    rateLimits: {
      perRecipientPerHour: 10,
    },
  },

  messaging: {
    broadcastTtlDays: 30,
    directRateLimitPerHour: 30,
  },

  retention: {
    auditLogDays: 90,
    completedFaultsArchiveMonths: null,
  },
};
