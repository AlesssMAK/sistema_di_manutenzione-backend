import { Schema } from 'mongoose';
import { model } from 'mongoose';
import { STATUS } from '../constants/status.js';

// A physical stock location. Multiple warehouses are supported; stock
// levels and movements are always scoped to one warehouse.
const warehouseSchema = new Schema(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    location: { type: String },
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

warehouseSchema.index(
  { code: 1 },
  { unique: true, name: 'Warehouse_code_unique' },
);

export const Warehouse = model('Warehouse', warehouseSchema);
