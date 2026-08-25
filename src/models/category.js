import { Schema, model } from 'mongoose';
import { STATUS } from '../constants/status.js';

// Item category, managed from the admin panel. Inventory items reference
// one at creation time (optional). Names are unique.
const categorySchema = new Schema(
  {
    name: { type: String, required: true },
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

categorySchema.index({ name: 1 }, { unique: true, name: 'Category_name_unique' });

export const Category = model('Category', categorySchema);
