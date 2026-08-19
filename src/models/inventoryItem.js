import { Schema } from 'mongoose';
import { model } from 'mongoose';
import { STATUS } from '../constants/status.js';

// Global catalog entry (SKU). The item master lives once; per-warehouse
// on-hand quantity is tracked separately in StockLevel. The unit of
// measure is chosen at creation time and referenced here.
const inventoryItemSchema = new Schema(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String },
    unitId: { type: Schema.Types.ObjectId, ref: 'Unit', required: true },
    note: { type: String },
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

inventoryItemSchema.index(
  { name: 'text', code: 'text' },
  { name: 'InventoryItemTextIndex' },
);
inventoryItemSchema.index(
  { code: 1 },
  { unique: true, name: 'InventoryItem_code_unique' },
);

export const InventoryItem = model('InventoryItem', inventoryItemSchema);
