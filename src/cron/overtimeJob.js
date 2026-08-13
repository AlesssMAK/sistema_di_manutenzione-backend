import { Fault } from '../models/fault.js';
import { STATUS_FAULT } from '../constants/statusFault.js';
import { getSettings } from '../services/systemSettings.js';
import { sendPushToUsers } from '../services/push/index.js';

// Push the assigned technician(s) when an In-progress fault runs past its
// planned duration by the configured threshold — once per work span
// (overtimeNotifiedAt guards against repeats; it is cleared on
// claim/resume). Complements the in-app modal for when nobody is looking.
export const runOvertimeScan = async () => {
  const settings = await getSettings();
  const hours = settings?.maintenance?.overtimeAlertHours ?? 0;
  if (!hours || hours <= 0) return { scanned: 0, notified: 0 };

  const now = Date.now();
  const candidates = await Fault.find({
    statusFault: STATUS_FAULT.IN_PROGRESS,
    overtimeNotifiedAt: null,
    workStartedAt: { $ne: null },
  })
    .select('faultId estimatedDuration workedMs workStartedAt assignedMaintainers')
    .lean();

  let notified = 0;
  for (const f of candidates) {
    const started = f.workStartedAt ? new Date(f.workStartedAt).getTime() : null;
    const workedMs = (f.workedMs ?? 0) + (started ? Math.max(0, now - started) : 0);
    const workedMin = Math.round(workedMs / 60000);
    const planned = f.estimatedDuration ?? 0;

    if (workedMin <= planned + hours * 60) continue;

    const recipients = (f.assignedMaintainers ?? []).map(String);
    if (recipients.length) {
      await sendPushToUsers(recipients, {
        title: `Intervento ${f.faultId} in ritardo`,
        body: `Superata la durata pianificata di ${planned} min.`,
        url: `/maintenance-worker/${f._id}`,
        tag: `overtime-${f._id}`,
      });
    }

    try {
      await Fault.updateOne(
        { _id: f._id },
        { $set: { overtimeNotifiedAt: new Date() } },
      );
      notified += 1;
    } catch (err) {
      console.error('[cron:overtime] flag update failed', f._id, err.message);
    }
  }

  if (candidates.length) {
    console.log(`[cron:overtime] scanned=${candidates.length} notified=${notified}`);
  }
  return { scanned: candidates.length, notified };
};
