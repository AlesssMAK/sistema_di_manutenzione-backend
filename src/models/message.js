import { model, Schema } from 'mongoose';
import {
  MESSAGE_TYPE,
  MESSAGE_TYPES,
  TARGETABLE_ROLES,
  MESSAGE_TTL_INDEX_NAME,
} from '../constants/message.js';

const messageSchema = new Schema(
  {
    type: {
      type: String,
      enum: MESSAGE_TYPES,
      required: true,
      index: true,
    },

    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    authorRole: {
      type: String,
      enum: TARGETABLE_ROLES,
      required: true,
    },

    // direct only
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    // broadcast_role only
    targetRole: {
      type: String,
      enum: TARGETABLE_ROLES,
      default: null,
    },

    subject: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    body: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 5000,
    },

    readBy: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },

    // Set only for broadcast_*; powers the TTL index below. Direct messages
    // leave it null so they are never auto-expired.
    expireAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

// Conditional invariants — keeps payloads honest without a discriminator tree.
messageSchema.pre('validate', function preValidate(next) {
  if (this.type === MESSAGE_TYPE.DIRECT) {
    if (!this.recipientId) {
      return next(new Error('recipientId is required for direct messages'));
    }
    if (this.targetRole) {
      return next(new Error('targetRole is not allowed on direct messages'));
    }
    this.expireAt = null;
  } else if (this.type === MESSAGE_TYPE.BROADCAST_ROLE) {
    if (!this.targetRole) {
      return next(
        new Error('targetRole is required for broadcast_role messages'),
      );
    }
    if (this.recipientId) {
      return next(
        new Error('recipientId is not allowed on broadcast messages'),
      );
    }
  } else if (this.type === MESSAGE_TYPE.BROADCAST_ALL) {
    if (this.targetRole) {
      return next(
        new Error('targetRole is not allowed on broadcast_all messages'),
      );
    }
    if (this.recipientId) {
      return next(
        new Error('recipientId is not allowed on broadcast messages'),
      );
    }
  }
  return next();
});

// Inbox / announcement listing.
messageSchema.index({ recipientId: 1, createdAt: -1 });
messageSchema.index({ type: 1, targetRole: 1, createdAt: -1 });
messageSchema.index({ authorId: 1, createdAt: -1 });

// TTL only fires on documents whose expireAt is an actual Date (broadcasts).
// expireAfterSeconds: 0 means "delete when expireAt <= now". Mongo's
// partialFilterExpression forbids $ne, so we use $type:'date' instead —
// direct messages keep null/undefined and stay outside the index.
messageSchema.index(
  { expireAt: 1 },
  {
    name: MESSAGE_TTL_INDEX_NAME,
    expireAfterSeconds: 0,
    partialFilterExpression: { expireAt: { $type: 'date' } },
  },
);

export const Message = model('Message', messageSchema);
