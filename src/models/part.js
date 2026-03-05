import { Schema } from 'mongoose';
import { model } from 'mongoose';

const partPlantSchema = new Schema(
  {
    plantId: { type: String, required: true },
    namePartPlant: { type: String, required: true },
    codePartPlant: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);
partPlantSchema.index(
  {
    namePartPlant: 'text',
    description: 'text',
  },
  { namePartPlant: 'PartPlantTextIndex' },
);

export const PartPlant = model('PartPlant', partPlantSchema);
