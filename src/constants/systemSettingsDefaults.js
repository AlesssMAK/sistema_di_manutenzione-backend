export const SYSTEM_SETTINGS_ID = 'global';

export const systemSettingsDefaults = {
  timezone: 'Europe/Rome',
  workHours: {
    start: '08:00',
    end: '17:00',
  },
  workDays: [1, 2, 3, 4, 5],
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
