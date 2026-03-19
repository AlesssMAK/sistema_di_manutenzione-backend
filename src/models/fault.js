import { model, Schema } from 'mongoose';
import { TYPE_FAULT } from '../constants/typeFault.js';
import { STATUS_FAULT } from '../constants/statusFault.js';

const faultSchema = new Schema(
  {
    faultId: {
      type: String,
      required: true,
      trim: true,
    },
    nameOperator: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dataCreated: {
      type: Date,
      required: true,
    },
    timeCreated: {
      type: String,
      required: true,
      trim: true,
    },
    plantId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Plant',
    },
    partId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'PartPlant',
    },
    typefault: {
      type: String,
      enum: Object.values(TYPE_FAULT),
      required: true,
      default: TYPE_FAULT.PRODUZIONE,
    },

    statusfault: {
      type: String,
      enum: Object.values(STATUS_FAULT),
      required: true,
      default: STATUS_FAULT.CREATED,
    },
    comment: {
      type: String,
      required: true,
    },
    img: {
      type: String,
      required: false,
    },
    priority: {
      type: String,
      enum: ['Bassa', 'Media', 'Alta'], // Низкая, Средняя, Высокая
      default: 'Media',
    },
    assignedMaintainers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User', //монтер
      },
    ],
    managerComment: {
      type: String,
      trim: true,
    },
    deadline: {
      type: String,
    },
    plannedDate: {
      type: String, // "Data Pianificata"
    },
    plannedTime: {
      type: String, // "Ora Pianificata"
    },
    estimatedDuration: {
      type: Number, // "Durata Stimata (minuti)"
      default: 60,
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    history: [
      {
        action: { type: String, required: true }, // 'created', 'updated'
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        userName: String,
        changes: Schema.Types.Mixed, // Здесь будем хранить старые/новые значения
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, versionKey: false },
);

faultSchema.methods.toJSON = function () {
  const obj = this.toObject();

  delete obj.password;
  return obj;
};
export const Fault = model('Fault', faultSchema);
