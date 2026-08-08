import mongoose from 'mongoose';
import { resetAndSeedDemo } from '../demo/seedDemoData.js';

// Periodic reset for the public demo: restores the known demo world so
// visitor changes don't accumulate over time. Scheduled only when
// DEMO_MODE is on (see cron/index.js), so it never runs in production.
export const runDemoReset = async () => {
  if (mongoose.connection.readyState !== 1) {
    console.warn('[cron:demo-reset] skipped — no active DB connection');
    return;
  }
  const summary = await resetAndSeedDemo();
  console.log('[cron:demo-reset] demo world reset', summary);
};
