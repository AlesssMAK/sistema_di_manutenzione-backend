import { Router } from 'express';
import { celebrate } from 'celebrate';
import { authenticate } from '../middleware/authenticate.js';
import {
  createFaultSchema,
  getAllFaultSchema,
  getDeadlinesSchema,
  getFaultByIdSchema,
  patchListSeenSchema,
} from '../validations/faultValidation.js';
import { upload } from '../middleware/multer.js';
import {
  createFault,
  getAllFault,
  getFaultById,
  getFaultDeadlines,
  getListSeen,
  markFaultSeen,
  patchListSeen,
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

// Per-list lastSeen timestamps (static segment — keep before :faultId).
router.get('/faults/list-seen', getListSeen);
router.patch(
  '/faults/list-seen',
  celebrate(patchListSeenSchema),
  patchListSeen,
);

router.get('/faults/:faultId', celebrate(getFaultByIdSchema), getFaultById);

// Mark a single fault individually seen (detail-open / claim).
router.post(
  '/faults/:faultId/seen',
  celebrate(getFaultByIdSchema),
  markFaultSeen,
);

export default router;
