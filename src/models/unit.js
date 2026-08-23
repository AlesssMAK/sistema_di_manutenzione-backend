import { Schema } from 'mongoose';
import { model } from 'mongoose';
import { STATUS } from '../constants/status.js';

// Unit of measure for inventory items (pz, m, kg, l, ...).
// Configurable from the admin panel; an item references one Unit
// picked at creation time.
const unitSchema = new Schema(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    // Whether quantities in this unit may be fractional. Piece-like
    // units (pezzo) stay integer; continuous ones (litri, kg, metri,
    // centimetri) allow decimals. Enforced in the quantity inputs.
    allowsDecimals: { type: Boolean, default: false },
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

unitSchema.index({ code: 1 }, { unique: true, name: 'Unit_code_unique' });

export const Unit = model('Unit', unitSchema);
