import cron from 'node-cron';
import { getSettings } from '../services/systemSettings.js';
import { runOverdueScan } from './overdueJob.js';
import { runReplanScan } from './replanJob.js';
import { runOvertimeScan } from './overtimeJob.js';
import { runDemoReset } from './demoResetJob.js';
import { isDemoMode } from '../constants/demo.js';

const OVERDUE_SCHEDULE = '*/5 * * * *';
const REPLAN_SCHEDULE = '30 0 * * *';
const OVERTIME_SCHEDULE = '*/5 * * * *';
// Public-demo housekeeping: wipe + reseed every 3 hours.
const DEMO_RESET_SCHEDULE = '0 */3 * * *';

let overdueTask = null;
let replanTask = null;
let overtimeTask = null;
let demoResetTask = null;
let activeTimezone = null;

const isEnabled = () => {
  const flag = process.env.CRON_ENABLED;
  return flag === undefined || flag === 'true' || flag === '1';
};

const stopTask = (task) => {
  if (!task) return;
  try {
    task.stop();
  } catch (err) {
    console.error('[cron] stop failed', err.message);
  }
};

const wrap = (name, fn) => async () => {
  try {
    await fn();
  } catch (err) {
    console.error(`[cron:${name}] execution failed`, err);
  }
};

export const startCronJobs = async () => {
  if (!isEnabled()) {
    console.log('🕒 Cron jobs disabled (CRON_ENABLED=false)');
    return;
  }

  const settings = await getSettings();
  activeTimezone = settings.timezone;

  overdueTask = cron.schedule(
    OVERDUE_SCHEDULE,
    wrap('overdue', runOverdueScan),
    { timezone: activeTimezone },
  );

  replanTask = cron.schedule(
    REPLAN_SCHEDULE,
    wrap('replan', runReplanScan),
    { timezone: activeTimezone },
  );

  overtimeTask = cron.schedule(
    OVERTIME_SCHEDULE,
    wrap('overtime', runOvertimeScan),
    { timezone: activeTimezone },
  );

  console.log(
    `🕒 Cron jobs started (tz=${activeTimezone}): overdue '${OVERDUE_SCHEDULE}', replan '${REPLAN_SCHEDULE}', overtime '${OVERTIME_SCHEDULE}'`,
  );

  // Demo-only: periodic reset of the public demo world. Additive and
  // guarded — never scheduled in production.
  if (isDemoMode()) {
    demoResetTask = cron.schedule(
      DEMO_RESET_SCHEDULE,
      wrap('demo-reset', runDemoReset),
      { timezone: activeTimezone },
    );
    console.log(`🧹 Demo reset cron started: '${DEMO_RESET_SCHEDULE}'`);
  }
};

export const stopCronJobs = () => {
  stopTask(overdueTask);
  stopTask(replanTask);
  stopTask(overtimeTask);
  stopTask(demoResetTask);
  overdueTask = null;
  replanTask = null;
  overtimeTask = null;
  demoResetTask = null;
  activeTimezone = null;
};

export const reloadCronJobs = async () => {
  const settings = await getSettings();
  if (settings.timezone === activeTimezone) return;
  console.log(
    `🕒 Reloading cron jobs (tz ${activeTimezone} → ${settings.timezone})`,
  );
  stopCronJobs();
  await startCronJobs();
};
