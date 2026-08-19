import { Schema } from 'mongoose';
import { model } from 'mongoose';

// Denormalized on-hand quantity per (item x warehouse). Maintained
// atomically on every StockMovement; the movements remain the source of
// truth. minLevel is per pair, so the same item can have different
// reorder points in different warehouses. Negative quantity is allowed
// (issuing more than on-hand is permitted with a warning).
const stockLevelSchema = new Schema(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
    },
    quantity: { type: Number, default: 0, required: true },
    minLevel: { type: Number, default: 0, required: true },
  },
  {
    timestamps: true,
  },
);

stockLevelSchema.index(
  { itemId: 1, warehouseId: 1 },
  { unique: true, name: 'StockLevel_item_warehouse_unique' },
);

export const StockLevel = model('StockLevel', stockLevelSchema);
