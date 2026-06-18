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

// Codes must be unique within a plant but two different plants can
// freely share the same code — e.g. each line numbers its motors
// 'MOT-01', 'MOT-02', matching what's stenciled on the hardware.
// Application-level checks in the controller scope by plantId; this
// index is the DB-level guard against races and direct mongo writes.
plantPartSchema.index(
  { plantId: 1, codePlantPart: 1 },
  { unique: true, name: 'PlantPart_plantId_code_unique' },
);

export const PlantPart = model('PlantPart', plantPartSchema);
