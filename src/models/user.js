import { model, Schema } from 'mongoose';
import { USER_STATUS } from '../constants/status.js';

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
      enum: USER_STATUS,
      default: USER_STATUS.ACTIVE,
      required: true,
    },
    isFirstLogin: {
      type: Boolean,
      default: true, // Чтобы отследить первый вход и заставить сменить пароль
    },
  },
  { timestamps: true, versionKey: false },
);

userSchema.methods.toJSON = function () {
  const obj = this.toObject();

  delete obj.password;
  return obj;
};
userSchema.methods.toJSON = function () {
  const obj = this.toObject();

  delete obj.personalCode;
  return obj;
};

export const User = model('User', userSchema);
