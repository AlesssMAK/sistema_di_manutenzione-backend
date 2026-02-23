import { celebrate } from 'celebrate';
import { Router } from 'express';
// import { authenticate } from '../middleware/authenticate.js';
import { createFaultSchema } from '../validations/faultValidation.js';
import { createFault } from '../controllers/opetatorController.js';
const router = Router();

router.post(
  '/operator/fault',
  // authenticate,
  celebrate(createFaultSchema),
  createFault,
);
export default router;
