import { Router } from 'express';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { runReplanScan } from '../cron/replanJob.js';
import { runOverdueScan } from '../cron/overdueJob.js';
import { logFromRequest } from '../services/auditLog.js';

const router = Router();

// Admin-only manual triggers — useful for testing & on-demand reruns.
// The same functions are scheduled by node-cron in src/cron/index.js.
router.use('/admin/cron', authenticate, authorizeRoles('admin'));

router.post(
  '/admin/cron/replan',
  ctrlWrapper(async (req, res) => {
    const result = await runReplanScan();
    await logFromRequest(req, {
      action: 'cron.reschedule',
      targetType: 'Fault',
      summary: `Manual replan trigger — scanned ${result.scanned} replanned ${result.replanned} skipped ${result.skipped}`,
      meta: result,
    });
    res.status(200).json({ ok: true, ...result });
  }),
);

router.post(
  '/admin/cron/overdue',
  ctrlWrapper(async (req, res) => {
    const result = await runOverdueScan();
    await logFromRequest(req, {
      action: 'cron.markOverdue',
      targetType: 'Fault',
      summary: `Manual overdue scan — scanned ${result.scanned ?? 0} updated ${result.updated ?? 0}`,
      meta: result,
    });
    res.status(200).json({ ok: true, ...result });
  }),
);

export default router;
