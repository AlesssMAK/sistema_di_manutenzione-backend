import { Fault } from '../models/fault.js';
import { STATUS_FAULT } from '../constants/statusFault.js';
import { getSettings } from '../services/systemSettings.js';
import { logEvent } from '../services/auditLog.js';
import { emitFaultUpdated } from '../socket/emitters.js';
import {
  endOfDayInZone,
  generateSlots,
  nextWorkingDay,
  parseDateInZone,
  todayInZone,
} from './workCalendar.js';

const REPLAN_HORIZON_DAYS = 30;

const isSlotFreeForFault = async (fault, slot) => {
  const maintainers = (fault.assignedMaintainers ?? []).map(String);
  if (maintainers.length === 0) return true;

  const conflict = await Fault.findOne({
    _id: { $ne: fault._id },
    plannedDate: slot.date,
    plannedTime: slot.time,
    assignedMaintainers: { $in: maintainers },
  })
    .select('_id')
    .lean();

  return !conflict;
};

const findFreeSlotForFault = async (fault, settings, todayStr) => {
  const tz = settings.timezone;
  const todayDt = parseDateInZone(todayStr, tz);
  const deadlineCutoff = fault.deadline
    ? endOfDayInZone(fault.deadline, tz)
    : null;

  let dayCursor = todayDt.minus({ days: 1 });
  for (let i = 0; i < REPLAN_HORIZON_DAYS; i += 1) {
    const workingDay = nextWorkingDay(dayCursor, settings);
    if (!workingDay) return null;
    dayCursor = workingDay;

    const slots = generateSlots(workingDay, settings);
    for (const slot of slots) {
      if (deadlineCutoff && slot.dateTime > deadlineCutoff) return null;
      const free = await isSlotFreeForFault(fault, slot);
      if (free) return slot;
    }
  }
  return null;
};

export const runReplanScan = async () => {
  const settings = await getSettings();
  const today = todayInZone(settings.timezone);

  const candidates = await Fault.find({
    plannedDate: { $exists: true, $ne: null, $ne: '', $lt: today },
    statusFault: { $nin: [STATUS_FAULT.COMPLETED] },
  });

  if (candidates.length === 0) {
    return { scanned: 0, replanned: 0, skipped: 0 };
  }

  let replanned = 0;
  let skipped = 0;

  for (const fault of candidates) {
    const previous = {
      plannedDate: fault.plannedDate,
      plannedTime: fault.plannedTime,
    };

    try {
      const slot = await findFreeSlotForFault(fault, settings, today);
      if (!slot) {
        skipped += 1;
        console.log(
          `[cron:replan] no free slot for fault ${fault.faultId} (deadline=${fault.deadline ?? 'none'})`,
        );
        continue;
      }

      fault.plannedDate = slot.date;
      fault.plannedTime = slot.time;
      fault.history.push({
        action: 'auto_replanned',
        userId: null,
        userName: 'system',
        changes: {
          plannedDate: { from: previous.plannedDate, to: slot.date },
          plannedTime: { from: previous.plannedTime, to: slot.time },
        },
        timestamp: new Date(),
      });

      await fault.save();
      await fault.populate('assignedMaintainers', 'name');
      replanned += 1;

      emitFaultUpdated(fault);

      logEvent({
        actorId: null,
        actorRole: 'system',
        action: 'fault.auto_replanned',
        targetType: 'Fault',
        targetId: String(fault._id),
        summary: `Fault ${fault.faultId} auto-replanned ${previous.plannedDate} ${previous.plannedTime} → ${slot.date} ${slot.time}`,
        meta: { previous, next: { plannedDate: slot.date, plannedTime: slot.time } },
      });
    } catch (err) {
      console.error(`[cron:replan] failed for fault ${fault._id}`, err.message);
    }
  }

  console.log(
    `[cron:replan] scanned=${candidates.length} replanned=${replanned} skipped=${skipped} (today=${today} ${settings.timezone})`,
  );
  return { scanned: candidates.length, replanned, skipped };
};
