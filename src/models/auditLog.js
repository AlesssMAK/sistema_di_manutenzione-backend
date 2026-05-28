import { model, Schema } from 'mongoose';
import {
  AUDIT_ACTIONS,
  AUDIT_ACTOR_ROLES,
  AUDIT_TARGETS,
} from '../constants/auditLog.js';

const auditLogSchema = new Schema(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    actorRole: {
      type: String,
      enum: AUDIT_ACTOR_ROLES,
      required: true,
    },

    action: {
      type: String,
      enum: AUDIT_ACTIONS,
      required: true,
      index: true,
    },

    targetType: {
      type: String,
      enum: AUDIT_TARGETS,
      default: null,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      default: null,
    },

    summary: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    meta: {
      type: Schema.Types.Mixed,
      default: null,
    },

    ip: { type: String, default: null },
    userAgent: { type: String, default: null, maxlength: 512 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AUDIT_TTL_INDEX_NAME = 'auditLog_ttl_createdAt';

export const AuditLog = model('AuditLog', auditLogSchema);
