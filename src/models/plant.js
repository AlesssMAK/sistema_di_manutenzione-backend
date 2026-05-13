import { Schema } from 'mongoose';
import { model } from 'mongoose';
import { STATUS } from '../constants/status.js';

const plantSchema = new Schema(
  {
    namePlant: { type: String, required: true },
    code: { type: String, required: true },
    location: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: STATUS,
      default: STATUS.ACTIVE,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);
plantSchema.index(
  {
    namePlant: 'text',
    description: 'text',
  },
  { namePlant: 'PlantTextIndex' },
);

export const Plant = model('Plant', plantSchema);
