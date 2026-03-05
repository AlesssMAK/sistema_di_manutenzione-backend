import { Router } from 'express';
import { addedByManagerSchema } from '../validations/faultValidation.js';
import { celebrate } from 'celebrate';
// import { authenticate } from '../middleware/authenticate';
import { addFault } from '../controllers/managerController.js';
const router = Router();

router.post(
  '/manager/fault',
  // authenticate,
  celebrate(addedByManagerSchema),
  addFault,
);
export default router;
