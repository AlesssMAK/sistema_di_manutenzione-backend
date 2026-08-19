import { Schema } from 'mongoose';
import { model } from 'mongoose';
import { MOVEMENT_TYPE, REFERENCE_TYPE } from '../constants/warehouse.js';

// Append-only ledger row. quantity is always stored positive; the sign
// of its effect on stock is derived from `type` (in +, out -, adjust
// sets the level). `reference` links an OUT movement to a fault, a
// free-text task/order, or nothing. `batchId` groups the rows created
// by a single multi-line operation (e.g. issuing several items for one
// task at once).
const referenceSchema = new Schema(
  {
    type: {
      type: String,
      enum: Object.values(REFERENCE_TYPE),
      default: REFERENCE_TYPE.NONE,
      required: true,
    },
    faultId: { type: Schema.Types.ObjectId, ref: 'Fault' },
    label: { type: String },
  },
  { _id: false },
);

const stockMovementSchema = new Schema(
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
    type: {
      type: String,
      enum: Object.values(MOVEMENT_TYPE),
      required: true,
    },
    quantity: { type: Number, required: true, min: 0 },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    reference: { type: referenceSchema, default: () => ({}) },
    note: { type: String },
    batchId: { type: Schema.Types.ObjectId },
  },
  {
    timestamps: true,
  },
);

stockMovementSchema.index({ itemId: 1, warehouseId: 1, createdAt: -1 });
stockMovementSchema.index({ 'reference.faultId': 1 });
stockMovementSchema.index({ batchId: 1 });

export const StockMovement = model('StockMovement', stockMovementSchema);
