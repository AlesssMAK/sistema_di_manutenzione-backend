import { model, Schema } from 'mongoose';

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
      required: false,
      trim: true,
      default: '',
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
      match: [/^\+380\d{9}$/, 'Phone must be in format +380XXXXXXXXX'],
    },
    avatar_id: {
      type: String,
      required: false,
      default: '',
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      trim: true,
      default: 'maintenanceWorker',
      enum: ['оperator', 'admin', 'manager', 'maintenanceWorker', 'safety'],
    },
  },
  { timestamps: true, versionKey: false },
);

userSchema.pre('save', function (next) {
  if (!this.name) {
    this.name = this.email;
  }
  next();
});

userSchema.methods.toJSON = function () {
  const obj = this.toObject();

  delete obj.password;
  return obj;
};
export const User = model('User', userSchema);
