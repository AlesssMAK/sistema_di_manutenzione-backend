import { Router } from 'express';
import { celebrate } from 'celebrate';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { updateFaultBySafety } from '../controllers/safetyController.js';
import { updateFaultBySafetySchema } from '../validations/faultValidation.js';

const router = Router();

router.patch(
  '/safety/fault/:faultId',
  authenticate,
  authorizeRoles('safety', 'admin'),
  celebrate(updateFaultBySafetySchema),
  ctrlWrapper(updateFaultBySafety),
);

export default router;
