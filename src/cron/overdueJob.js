import { Fault } from '../models/fault.js';
import { STATUS_FAULT } from '../constants/statusFault.js';
import { getSettings } from '../services/systemSettings.js';
import { logEvent } from '../services/auditLog.js';
import { emitFaultStatusChanged } from '../socket/emitters.js';
import { todayInZone } from './workCalendar.js';

const ACTIVE_STATUSES = [
  STATUS_FAULT.CREATED,
  STATUS_FAULT.IN_PROGRESS,
  STATUS_FAULT.SUSPENDED,
];

export const runOverdueScan = async () => {
  const settings = await getSettings();
  const today = todayInZone(settings.timezone);

  const candidates = await Fault.find({
    deadline: { $exists: true, $ne: null, $ne: '', $lt: today },
    statusFault: { $in: ACTIVE_STATUSES },
  });

  if (candidates.length === 0) {
    return { scanned: 0, updated: 0 };
  }

  let updated = 0;
  for (const fault of candidates) {
    const previousStatus = fault.statusFault;
    fault.statusFault = STATUS_FAULT.OVERDUE;
    fault.history.push({
      action: 'auto_overdue',
      userId: null,
      userName: 'system',
      changes: { statusFault: STATUS_FAULT.OVERDUE, previousStatus },
      timestamp: new Date(),
    });

    try {
      await fault.save();
      updated += 1;

      emitFaultStatusChanged(fault._id, {
        from: previousStatus,
        to: STATUS_FAULT.OVERDUE,
        userId: null,
      });

      logEvent({
        actorId: null,
        actorRole: 'system',
        action: 'fault.auto_overdue',
        targetType: 'Fault',
        targetId: String(fault._id),
        summary: `Fault ${fault.faultId} auto-marked Overdue (deadline ${fault.deadline} < ${today})`,
        meta: { from: previousStatus, to: STATUS_FAULT.OVERDUE, deadline: fault.deadline },
      });
    } catch (err) {
      console.error(`[cron:overdue] failed to update fault ${fault._id}`, err.message);
    }
  }

  console.log(`[cron:overdue] scanned=${candidates.length} updated=${updated} (today=${today} ${settings.timezone})`);
  return { scanned: candidates.length, updated };
};
