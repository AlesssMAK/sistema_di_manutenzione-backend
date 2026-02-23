import { celebrate } from 'celebrate';
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { createFaultSchema } from '../validations/faultValidation.js';
import { createFault } from '../controllers/opetatorController.js';
import { upload } from '../middleware/multer.js';
const router = Router();

router.post(
  '/operator/fault',
  authenticate,
  upload.single('img'),
  celebrate(createFaultSchema),
  createFault,
);
export default router;
