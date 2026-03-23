import { Router } from 'express';
import { celebrate } from 'celebrate';
// import { authenticate } from '../middleware/authenticate.js';
import {
  createFaultSchema,
  getAllFaultSchema,
  getFaultByIdSchema,
} from '../validations/faultValidation.js';
import { upload } from '../middleware/multer.js';
import {
  createFault,
  getAllFault,
  getFaultById,
} from '../controllers/faultController.js';

const router = Router();

// router.use('/faults', authenticate);

router.post(
  '/faults',
  upload.single('img'),
  celebrate(createFaultSchema),
  createFault,
);

router.get('/faults', celebrate(getAllFaultSchema), getAllFault);

router.get('/faults/:faultId', celebrate(getFaultByIdSchema), getFaultById);

export default router;
