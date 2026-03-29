import { Schema } from 'mongoose';
import { model } from 'mongoose';

const plantPartSchema = new Schema(
  {
    plantId: { type: Schema.Types.ObjectId, ref: 'Plant', required: true },
    namePlantPart: { type: String, required: true },
    codePlantPart: { type: String, required: true },
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
