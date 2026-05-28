import { Router } from 'express';
import { celebrate } from 'celebrate';
import { authenticate } from '../middleware/authenticate.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import {
  listAuditLogSchema,
  getAuditLogByIdSchema,
} from '../validations/auditLogValidation.js';
import {
  listAuditLogs,
  getAuditLogById,
} from '../controllers/auditLogController.js';

const router = Router();

router.get(
  '/admin/audit-log',
  authenticate,
  requireAdmin,
  celebrate(listAuditLogSchema),
  ctrlWrapper(listAuditLogs),
);

router.get(
  '/admin/audit-log/:id',
  authenticate,
  requireAdmin,
  celebrate(getAuditLogByIdSchema),
  ctrlWrapper(getAuditLogById),
);

export default router;
