import { Router } from 'express';
import {
  createPartPlantSchema,
  getPartsSchema,
} from '../validations/partplantValidation.js';
import { celebrate } from 'celebrate';
import { authenticate } from '../middleware/authenticate.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  createPartPlant,
  getAllPartPlants,
} from '../controllers/partPlantController.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
const router = Router();
router.post(
  '/plants/parts',
  authenticate,
  requireAdmin,
  celebrate(createPartPlantSchema),
  createPartPlant,
);
router.get(
  '/:plantId/parts',
  celebrate(getPartsSchema),
  ctrlWrapper(getAllPartPlants),
);
export default router;
