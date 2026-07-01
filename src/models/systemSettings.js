import { model, Schema } from 'mongoose';
import { DateTime } from 'luxon';

const HH_MM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const isValidIanaZone = (tz) => DateTime.local().setZone(tz).isValid;

// Per-day schedule entry. enabled=false → the factory is closed that
// day; 24h is stored as start='00:00' end='23:59'.
const dayScheduleSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    start: { type: String, match: HH_MM_REGEX, default: '08:00' },
    end: { type: String, match: HH_MM_REGEX, default: '17:00' },
  },
  { _id: false },
);

const WEEK_DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

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

    // Per-day working hours. Source of truth for scheduling; workDays/
    // workHours above are kept for backward compatibility.
    weekSchedule: {
      mon: dayScheduleSchema,
      tue: dayScheduleSchema,
      wed: dayScheduleSchema,
      thu: dayScheduleSchema,
      fri: dayScheduleSchema,
      sat: dayScheduleSchema,
      sun: dayScheduleSchema,
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
        onSuspended: { type: Boolean, default: true },
        onReassign: { type: Boolean, default: true },
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

const minutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

systemSettingsSchema.pre('validate', function (next) {
  if (this.workHours?.start && this.workHours?.end) {
    if (minutes(this.workHours.start) >= minutes(this.workHours.end)) {
      return next(new Error('workHours.end must be later than workHours.start'));
    }
  }

  const ws = this.weekSchedule;
  if (ws) {
    for (const key of WEEK_DAY_KEYS) {
      const day = ws[key];
      if (day?.enabled && day.start && day.end) {
        if (minutes(day.start) >= minutes(day.end)) {
          return next(
            new Error(`weekSchedule.${key}: end must be later than start`),
          );
        }
      }
    }
  }

  next();
});

export const SystemSettings = model('SystemSettings', systemSettingsSchema);
