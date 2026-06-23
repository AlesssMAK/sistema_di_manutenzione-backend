import { model, Schema } from 'mongoose';

// One row per browser/device a user has granted push permission on.
// A single user can have several (work laptop + phone, etc.); the
// endpoint is globally unique so re-subscribing the same browser
// upserts rather than duplicating.
const pushSubscriptionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

export const PushSubscription = model(
  'PushSubscription',
  pushSubscriptionSchema,
);
