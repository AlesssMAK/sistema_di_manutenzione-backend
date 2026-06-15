import cron from 'node-cron';
import { getSettings } from '../services/systemSettings.js';
import { runOverdueScan } from './overdueJob.js';
import { runReplanScan } from './replanJob.js';

const OVERDUE_SCHEDULE = '*/5 * * * *';
const REPLAN_SCHEDULE = '30 0 * * *';

let overdueTask = null;
let replanTask = null;
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

  console.log(
    `🕒 Cron jobs started (tz=${activeTimezone}): overdue '${OVERDUE_SCHEDULE}', replan '${REPLAN_SCHEDULE}'`,
  );
};

export const stopCronJobs = () => {
  stopTask(overdueTask);
  stopTask(replanTask);
  overdueTask = null;
  replanTask = null;
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
