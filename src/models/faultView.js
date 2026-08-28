import { model, Schema } from 'mongoose';

// Per-user "I have seen this specific fault" record. Drives the
// individual unseen dot on fault cards (model B: faults that are mine
// or in the pool stay flagged until the user actually opens the card).
// A fault counts as individually seen only while seenAt >= fault.updatedAt
// — a later change (new comment, reassignment, status change) bumps the
// fault's updatedAt and re-flags it as unseen.
const faultViewSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fault: { type: Schema.Types.ObjectId, ref: 'Fault', required: true },
    seenAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

// One row per (user, fault); mark-seen upserts on this pair.
faultViewSchema.index({ user: 1, fault: 1 }, { unique: true });

export const FaultView = model('FaultView', faultViewSchema);
