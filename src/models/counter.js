import { Schema, model } from 'mongoose';

const counterSchema = new Schema({
  id: { type: String, required: true, unique: true },
});

export const Counter = model('Counter', counterSchema);
