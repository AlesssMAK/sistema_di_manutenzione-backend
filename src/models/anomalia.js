import { model, Schema } from 'mongoose';
import { TYPE_ANOMALII } from '../constants/typeAnomalii';

const anomaliaSchema = new Schema(
  {
    id_anomalii: {
      type: String,
      required: true,
      trim: true,
    },
    nameOperator: {
      type: String,
      unique: true,
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
      trim: true,
    },
    partId: {
      type: String,
      required: true,
    },
    typeAnomalii: {
      type: String,
      enum: TYPE_ANOMALII,
      required: true,
      default: 'Produzione',
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

anomaliaSchema.methods.toJSON = function () {
  const obj = this.toObject();

  delete obj.password;
  return obj;
};
export const Anomalia = model('Anomalia', anomaliaSchema);
