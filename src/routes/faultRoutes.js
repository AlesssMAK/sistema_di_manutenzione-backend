import { Router } from 'express';
import { celebrate } from 'celebrate';
import { authenticate } from '../middleware/authenticate.js';
import { createFaultSchema } from '../validations/faultValidation.js';
import { upload } from '../middleware/multer.js';
import { createFault } from '../controllers/faultController.js';

const router = Router();

router.post(
  '/fault',
  authenticate,
  upload.single('img'),
  celebrate(createFaultSchema),
  createFault,
);

// router.get('/fault', )

export default router;
