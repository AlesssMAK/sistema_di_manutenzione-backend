import { celebrate } from 'celebrate';
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { createFaultSchema } from '../validations/faultValidation.js';
import {
  createFault,
  getAllOperators,
} from '../controllers/opetatorController.js';
import { upload } from '../middleware/multer.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
const router = Router();

router.post(
  '/operator/fault',
  authenticate,
  upload.single('img'),
  celebrate(createFaultSchema),
  createFault,
);
router.get('/operators', ctrlWrapper(getAllOperators));
export default router;
