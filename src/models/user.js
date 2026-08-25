import { model, Schema } from 'mongoose';
import { STATUS } from '../constants/status.js';

const userSchema = new Schema(
  {
    role: {
      type: String,
      required: [true, 'Role is required'],
      trim: true,
      default: 'operator',
      enum: ['operator', 'admin', 'manager', 'maintenanceWorker', 'safety'],
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: function () {
        return this.role !== 'operator';
      },
    },
    personalCode: {
      type: String,
      required: function () {
        return this.role === 'operator';
      },
      unique: true,
      sparse: true, // Позволяет быть null для админов, но уникальным для операторов
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{2}\d{5}$/, 'Code must be in format OP00001'],
    },
    avatar: {
      type: String,
      required: false,
      default: '',
    },
    status: {
      type: String,
      enum: STATUS,
      default: STATUS.ACTIVE,
      required: true,
    },
    isFirstLogin: {
      type: Boolean,
      default: true, // Чтобы отследить первый вход и заставить сменить пароль
    },
    // Self-service password reset. We store only the SHA-256 hash of the
    // token; the raw token lives solely in the emailed link.
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    permissions: {
      // Admin-granted per-user rights, managed from the global settings
      // tab. canCreateAnnouncements → publish to the public board;
      // canSendMessages → lets an operator use direct messaging
      // (other roles can already message).
      // canManageWarehouse → manage the warehouse catalog/config
      // (warehouses, units, items). canOperateWarehouse → move stock
      // (receive, issue, adjust). Both are role-agnostic so a future
      // warehouse-keeper is simply a user with these grants.
      canCreateAnnouncements: { type: Boolean, default: false },
      canSendMessages: { type: Boolean, default: false },
      canManageWarehouse: { type: Boolean, default: false },
      canOperateWarehouse: { type: Boolean, default: false },
    },
    // Which warehouses this user may operate on. Empty = ALL (no
    // restriction); a non-empty list limits stock moves to those
    // warehouses. `canOperateWarehouse` stays the general on/off; this
    // only narrows WHICH warehouses. Admins are never restricted.
    allowedWarehouses: [{ type: Schema.Types.ObjectId, ref: 'Warehouse' }],
    // Per-tab "last seen" timestamps for the maintenance-worker board.
    // Drive the unseen-count badges: a fault counts as new when its
    // relevant timestamp is later than the tab's lastSeen.
    maintenanceSeen: {
      active: { type: Date, default: null },
      overdue: { type: Date, default: null },
      completed: { type: Date, default: null },
      pool: { type: Date, default: null },
    },
  },
  { timestamps: true, versionKey: false },
);

userSchema.methods.toJSON = function () {
  const obj = this.toObject();

  delete obj.password;
  delete obj.personalCode;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;

  return obj;
};

export const User = model('User', userSchema);
