import { Router } from 'express';
import {
  createPlantPartSchema,
  getPartsSchema,
} from '../validations/plantPartValidation.js';
import { celebrate } from 'celebrate';
import { authenticate } from '../middleware/authenticate.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  createPlantPart,
  getAllPlantParts,
} from '../controllers/plantPartController.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
const router = Router();
router.post(
  '/plants/parts',
  authenticate,
  requireAdmin,
  celebrate(createPlantPartSchema),
  createPlantPart,
);
router.get(
  '/:plantId/parts',
  celebrate(getPartsSchema),
  ctrlWrapper(getAllPlantParts),
);
export default router;
