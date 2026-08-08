/**
 * Demo seed CLI. Connects to MONGO_URL and runs the shared
 * reset-and-seed routine (see src/demo/seedDemoData.js), which WIPES the
 * demo collections and inserts a fresh demo world (plants, parts, one
 * user per role, faults across statuses, announcements, messages).
 *
 * Never run this against a real database — it deletes data. Point
 * MONGO_URL at a throwaway demo database.
 *
 * Usage:
 *   npm run seed
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { resetAndSeedDemo, DEMO_PASSWORD } from '../src/demo/seedDemoData.js';

const main = async () => {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    console.error('Missing MONGO_URL');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);

  try {
    const summary = await resetAndSeedDemo();
    console.log('Seeded:', summary);
    console.log(`✅ Seed done. Demo password: ${DEMO_PASSWORD}`);
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});
