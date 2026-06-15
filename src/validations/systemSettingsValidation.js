import { Joi, Segments } from 'celebrate';

const hhmm = Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/);

const workHoursSchema = Joi.object({
  start: hhmm.required(),
  end: hhmm.required(),
}).custom((value, helpers) => {
  const [sh, sm] = value.start.split(':').map(Number);
  const [eh, em] = value.end.split(':').map(Number);
  if (sh * 60 + sm >= eh * 60 + em) {
    return helpers.message('workHours.end must be later than workHours.start');
  }
  return value;
});

const emailSchema = Joi.object({
  enabled: Joi.boolean(),
  from: Joi.string().trim().email({ tlds: { allow: false } }),
  triggers: Joi.object({
    onAssignment: Joi.boolean(),
    onNewFault: Joi.boolean(),
    onSicurezzaHse: Joi.boolean(),
    onDirectMessage: Joi.boolean(),
  }),
  rateLimits: Joi.object({
    perRecipientPerHour: Joi.number().integer().min(0).max(1000),
  }),
});

const messagingSchema = Joi.object({
  broadcastTtlDays: Joi.number().integer().min(1).max(365),
  directRateLimitPerHour: Joi.number().integer().min(0).max(1000),
});

const retentionSchema = Joi.object({
  auditLogDays: Joi.number().integer().min(1).max(3650),
  completedFaultsArchiveMonths: Joi.number().integer().min(1).max(120).allow(null),
});

export const updateSystemSettingsSchema = {
  [Segments.BODY]: Joi.object({
    // IANA tz identifier (e.g. Europe/Rome). Loose pattern — luxon
    // re-validates inside ensureSingleton/save hooks.
    timezone: Joi.string().trim().pattern(/^[A-Za-z][A-Za-z0-9_+-]*\/[A-Za-z][A-Za-z0-9_+-]*$/),
    workHours: workHoursSchema,
    workDays: Joi.array()
      .items(Joi.number().integer().min(0).max(6))
      .unique(),
    slotDurationMinutes: Joi.number().integer().min(5).max(240),
    holidays: Joi.array().items(Joi.date().iso()),
    email: emailSchema,
    messaging: messagingSchema,
    retention: retentionSchema,
  })
    .min(1)
    .required(),
};
