/**
 * Demo seed: two plants with a handful of parts each, one user
 * per role. Idempotent — every insert is a `findOneAndUpdate`
 * upsert keyed on the natural unique field, so re-running the
 * script doesn't create duplicates or fail with a unique-index
 * conflict.
 *
 * Passwords for the demo accounts are intentionally weak; do not
 * run this against a real database. Operators get a personalCode
 * (no password); everyone else gets `Demo1234!`.
 *
 * Usage:
 *   npm run seed
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from '../src/models/user.js';
import { Plant } from '../src/models/plant.js';
import { PlantPart } from '../src/models/part.js';

const DEMO_PASSWORD = 'Demo1234!';

const plants = [
  {
    namePlant: 'Linea Imbottigliamento',
    code: 'L-IMB-01',
    location: 'Capannone A',
    description: 'Demo line for bottling',
    parts: [
      { namePlantPart: 'Cilindro idraulico', codePlantPart: 'CIL-01' },
      { namePlantPart: 'Motore principale', codePlantPart: 'MOT-01' },
      { namePlantPart: 'Nastro trasportatore', codePlantPart: 'NAS-01' },
    ],
  },
  {
    namePlant: 'Linea Etichettatura',
    code: 'L-ETI-02',
    location: 'Capannone B',
    description: 'Demo line for labelling',
    parts: [
      // Same codes as the other plant on purpose — the compound
      // unique index allows reuse across plants.
      { namePlantPart: 'Motore etichettatrice', codePlantPart: 'MOT-01' },
      { namePlantPart: 'Sensore di posizione', codePlantPart: 'SEN-01' },
    ],
  },
];

const users = [
  // operators identify by personalCode (no password)
  { role: 'operator', fullName: 'Operatore Demo', email: 'operator@demo.local', personalCode: 'OP00001' },
  { role: 'manager', fullName: 'Manager Demo', email: 'manager@demo.local' },
  { role: 'maintenanceWorker', fullName: 'Manutentore Demo', email: 'maintainer@demo.local' },
  { role: 'safety', fullName: 'Responsabile Sicurezza', email: 'safety@demo.local' },
];

const main = async () => {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    console.error('Missing MONGO_URL');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);

  try {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    for (const { parts, ...plant } of plants) {
      const upserted = await Plant.findOneAndUpdate(
        { code: plant.code },
        { $set: plant },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      console.log(`Plant ${upserted.code} ready (${upserted._id})`);

      for (const part of parts) {
        await PlantPart.findOneAndUpdate(
          { plantId: upserted._id, codePlantPart: part.codePlantPart },
          { $set: { ...part, plantId: upserted._id } },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        );
      }
    }

    for (const user of users) {
      const update = { ...user };
      if (user.role !== 'operator') update.password = passwordHash;
      await User.findOneAndUpdate(
        { email: user.email },
        { $set: update, $setOnInsert: { isFirstLogin: false } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      console.log(`User ${user.email} ready (${user.role})`);
    }

    console.log(`✅ Seed done. Demo password: ${DEMO_PASSWORD}`);
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});
