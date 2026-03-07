import { Router } from 'express';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import { getAllMaintenanceWorker } from '../controllers/maintenanceWorkerController.js';

const router = Router();

router.get('/maintenance-worker', ctrlWrapper(getAllMaintenanceWorker));

export default router;
