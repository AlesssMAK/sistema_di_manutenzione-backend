import { Schema } from 'mongoose';
import { model } from 'mongoose';

const partPlantSchema = new Schema(
  {
    plants: [
      {
        plantId: {
          type: Schema.Types.ObjectId,
          ref: 'Plant',
          required: true,
        },
      },
    ],
    namePartPlant: { type: String, required: true },
    codePartPlant: { type: String, required: true },
    location: { type: String, required: true },
    description: { type: String },
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
