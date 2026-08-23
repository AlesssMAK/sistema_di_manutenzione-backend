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
    // Optional package intake: items delivered in boxes/rolls/canisters
    // store how many usage-units one package holds. `unitsPerPackage`
    // lets the Carico (stock-in) form accept a package count and expand
    // it to usage-units; `packageLabel` names the package for display
    // (e.g. "Scatola", "Rotolo"). Consumption stays in the usage unit.
    packageLabel: { type: String },
    unitsPerPackage: { type: Number, min: 0 },
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
