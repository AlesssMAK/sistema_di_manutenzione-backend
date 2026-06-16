import { Router } from 'express';
import {
  addedByManagerSchema,
  reassignFaultSchema,
} from '../validations/faultValidation.js';
import { celebrate } from 'celebrate';
// import { authenticate } from '../middleware/authenticate';
import {
  addFault,
  reassignFault,
} from '../controllers/managerController.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';

const router = Router();

router.post(
  '/manager/fault',
  // authenticate,
  celebrate(addedByManagerSchema),
  addFault,
);

router.patch(
  '/manager/fault/:faultId/reassign',
  // authenticate,
  celebrate(reassignFaultSchema),
  ctrlWrapper(reassignFault),
);

export default router;
