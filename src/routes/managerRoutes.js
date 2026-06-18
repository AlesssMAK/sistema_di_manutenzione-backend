import { Router } from 'express';
import {
  addedByManagerSchema,
  addMaintainersSchema,
  reassignFaultSchema,
} from '../validations/faultValidation.js';
import { celebrate } from 'celebrate';
// import { authenticate } from '../middleware/authenticate';
import {
  addFault,
  addMaintainers,
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

router.post(
  '/manager/fault/:faultId/add-maintainers',
  // authenticate,
  celebrate(addMaintainersSchema),
  ctrlWrapper(addMaintainers),
);

export default router;
