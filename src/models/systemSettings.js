import { model, Schema } from 'mongoose';
import { DateTime } from 'luxon';

const HH_MM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const isValidIanaZone = (tz) => DateTime.local().setZone(tz).isValid;

const systemSettingsSchema = new Schema(
  {
    _id: { type: String, default: 'global' },

    timezone: {
      type: String,
      required: true,
      default: 'Europe/Rome',
      validate: {
        validator: isValidIanaZone,
        message: (props) => `${props.value} is not a valid IANA timezone`,
      },
    },

    workHours: {
      start: {
        type: String,
        required: true,
        match: HH_MM_REGEX,
      },
      end: {
        type: String,
        required: true,
        match: HH_MM_REGEX,
      },
    },

    workDays: {
      type: [Number],
      validate: {
        validator: (arr) => arr.every((d) => Number.isInteger(d) && d >= 0 && d <= 6),
        message: 'workDays must contain integers 0..6',
      },
      default: [1, 2, 3, 4, 5],
    },

    slotDurationMinutes: {
      type: Number,
      required: true,
      min: 5,
      max: 240,
      default: 30,
    },

    holidays: {
      type: [Date],
      default: [],
    },

    email: {
      enabled: { type: Boolean, default: true },
      from: { type: String, default: 'noreply@mms.local', trim: true },
      triggers: {
        onAssignment: { type: Boolean, default: true },
        onNewFault: { type: Boolean, default: true },
        onSicurezzaHse: { type: Boolean, default: true },
        onDirectMessage: { type: Boolean, default: true },
      },
      rateLimits: {
        perRecipientPerHour: { type: Number, min: 0, default: 10 },
      },
    },

    messaging: {
      broadcastTtlDays: { type: Number, min: 1, max: 365, default: 30 },
      directRateLimitPerHour: { type: Number, min: 0, default: 30 },
    },

    retention: {
      auditLogDays: { type: Number, min: 1, max: 3650, default: 90 },
      completedFaultsArchiveMonths: { type: Number, min: 1, max: 120, default: null },
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true, versionKey: false, _id: false },
);

systemSettingsSchema.pre('validate', function (next) {
  if (this.workHours?.start && this.workHours?.end) {
    const [sh, sm] = this.workHours.start.split(':').map(Number);
    const [eh, em] = this.workHours.end.split(':').map(Number);
    if (sh * 60 + sm >= eh * 60 + em) {
      return next(new Error('workHours.end must be later than workHours.start'));
    }
  }
  next();
});

export const SystemSettings = model('SystemSettings', systemSettingsSchema);
