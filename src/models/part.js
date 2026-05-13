import { Schema } from 'mongoose';
import { model } from 'mongoose';
import { STATUS } from '../constants/status.js';

const plantPartSchema = new Schema(
  {
    plantId: { type: Schema.Types.ObjectId, ref: 'Plant', required: true },
    namePlantPart: { type: String, required: true },
    codePlantPart: { type: String, required: true },
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
plantPartSchema.index(
  {
    namePlantPart: 'text',
    description: 'text',
  },
  { namePlantPart: 'PlantPartTextIndex' },
);

export const PlantPart = model('PlantPart', plantPartSchema);
