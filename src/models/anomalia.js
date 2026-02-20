import { model, Schema } from 'mongoose';

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
    timeCraeted: {
      type: String,
      required: true,
      trim: true,
    },

    plantId: {
      type: String,
      required: false,
      trim: true,
      default: '',
    },
    partId: {
      type: String,
      required: [true, 'Phone number is required'],
    },
    typeAnomalii: {
      type: String,
      required: false,
      default: '',
    },
    comment: {
      type: String,
      required: [true, 'Role is required'],
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
