import { model, Schema } from 'mongoose';
import { USER_STATUS } from '../constants/status.js';

const userSchema = new Schema(
  {
    name: {
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
    lastname: {
      type: String,
      required: true,
      trim: true,
    },
    // возможно нужно добавить и страну
    city: {
      type: String,
      required: false,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      match: [/^\+39\d{10}$/, 'Phone must be in format +39XXXXXXXXXX'], //для Италии
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
  },
  { timestamps: true, versionKey: false },
);

userSchema.methods.toJSON = function () {
  const obj = this.toObject();

  delete obj.password;
  return obj;
};
export const User = model('User', userSchema);
