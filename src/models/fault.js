import { model, Schema } from 'mongoose';
import { TYPE_FAULT } from '../constants/typeFault.js';

const faultSchema = new Schema(
  {
    id_fault: {
      type: String,
      required: true,
      trim: true,
    },
    nameOperator: {
      type: String,
      required: true,
      trim: true,
    },
    dataCreated: {
      type: String,
      required: true,
    },
    timeCreated: {
      type: String,
      required: true,
      trim: true,
    },

    plantId: {
      type: String,
      required: true,
      ref: 'Plant',
    },
    partId: {
      type: String,
      required: true,
      ref: 'PartPlant',
    },
    typefault: {
      type: String,
      enum: Object.values(TYPE_FAULT),
      required: true,
      default: TYPE_FAULT.PRODUZIONE,
    },
    comment: {
      type: String,
      required: true,
    },
    img: {
      type: String,
      required: false,
    },
  },
  { timestamps: true, versionKey: false },
);

faultSchema.methods.toJSON = function () {
  const obj = this.toObject();

  delete obj.password;
  return obj;
};
export const Fault = model('Fault', faultSchema);
