import { model, Schema } from 'mongoose';
import { USER_STATUS } from '../constants/status.js';

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
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
      required: true,
    },
    avatar: {
      type: String,
      required: false,
      default: '',
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      trim: true,
      default: 'operator',
      enum: ['operator', 'admin', 'manager', 'maintenanceWorker', 'safety'],
    },
    status: {
      type: String,
      enum: USER_STATUS,
      default: USER_STATUS.ACTIVE,
      required: true,
    },
    personalCode: {
      type: String,
      unique: true,
      sparse: true, // Позволяет быть null для админов, но уникальным для операторов
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{2}\d{3}$/, 'Code must be in format OP001'],
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

export const User = model('User', userSchema);
