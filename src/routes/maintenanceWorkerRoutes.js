import { Router } from 'express';
import { celebrate } from 'celebrate';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import {
  addFaultByMaintenanceWorker,
  claimFault,
  getAllMaintenanceWorker,
} from '../controllers/maintenanceWorkerController.js';
import {
  claimFaultSchema,
  updateFaultByMaintenanceWorkerSchema,
} from '../validations/faultValidation.js';

const router = Router();

router.use('/maintenance-worker', authenticate);

router.get(
  '/maintenance-worker',
  authorizeRoles('manager', 'admin', 'maintenanceWorker'),
  ctrlWrapper(getAllMaintenanceWorker),
);

// claim must be registered BEFORE the generic :faultId route so that
// '/fault/:faultId/claim' is matched as claim, not as faultId='claim'
router.patch(
  '/maintenance-worker/fault/:faultId/claim',
  authorizeRoles('maintenanceWorker', 'admin'),
  celebrate(claimFaultSchema),
  ctrlWrapper(claimFault),
);

router.patch(
  '/maintenance-worker/fault/:faultId',
  authorizeRoles('maintenanceWorker', 'admin'),
  celebrate(updateFaultByMaintenanceWorkerSchema),
  ctrlWrapper(addFaultByMaintenanceWorker),
);

export default router;
