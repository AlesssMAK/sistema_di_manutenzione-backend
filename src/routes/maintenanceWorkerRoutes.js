import { Router } from 'express';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import {
  addFaultByMaintenanceWorker,
  getAllMaintenanceWorker,
} from '../controllers/maintenanceWorkerController.js';
// import { authenticate } from '../middleware/authenticate';
import { celebrate } from 'celebrate';
import { addFaultByMaintenanceWorkerSchema } from '../validations/faultValidation.js';

const router = Router();

router.get('/maintenance-worker', ctrlWrapper(getAllMaintenanceWorker));
router.patch(
  '/maintenance-worker/fault',
  // authenticate,
  celebrate(addFaultByMaintenanceWorkerSchema),
  addFaultByMaintenanceWorker,
);
export default router;
