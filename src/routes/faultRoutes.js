import { Router } from 'express';
import { celebrate } from 'celebrate';
import { authenticate } from '../middleware/authenticate.js';
import {
  createFaultSchema,
  getAllFaultSchema,
  getDeadlinesSchema,
  getFaultByIdSchema,
} from '../validations/faultValidation.js';
import { upload } from '../middleware/multer.js';
import {
  createFault,
  getAllFault,
  getFaultById,
  getFaultDeadlines,
} from '../controllers/faultController.js';

const router = Router();

router.use('/faults', authenticate);

router.post(
  '/faults',
  upload.array('img', 5),
  celebrate(createFaultSchema),
  createFault,
);

router.get('/faults', celebrate(getAllFaultSchema), getAllFault);

// Must be registered BEFORE /faults/:faultId, otherwise the dynamic
// route would try to interpret "deadlines" as an ObjectId.
router.get(
  '/faults/deadlines',
  celebrate(getDeadlinesSchema),
  getFaultDeadlines,
);

router.get('/faults/:faultId', celebrate(getFaultByIdSchema), getFaultById);

export default router;
