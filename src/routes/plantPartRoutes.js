import { Router } from 'express';
import {
  createPlantPartsSchema,
  deletePlantPartSchema,
  getPartsSchema,
  updatePlantPartSchema,
} from '../validations/plantPartValidation.js';
import { celebrate } from 'celebrate';
import { authenticate } from '../middleware/authenticate.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  createPlantParts,
  deletePlantPart,
  getAllPlantParts,
  updatePlantPart,
} from '../controllers/plantPartController.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
const router = Router();

router.post(
  '/plants/parts',
  authenticate,
  requireAdmin,
  celebrate(createPlantPartsSchema),
  createPlantParts,
);

router.get(
  '/plants/:plantId/parts',
  authenticate,
  celebrate(getPartsSchema),
  ctrlWrapper(getAllPlantParts),
);

router.put(
  '/plants/:plantId/parts/:plantPartId',
  authenticate,
  requireAdmin,
  celebrate(updatePlantPartSchema),
  ctrlWrapper(updatePlantPart),
);

router.delete(
  '/plants/:plantId/parts/:plantPartId',
  authenticate,
  requireAdmin,
  celebrate(deletePlantPartSchema),
  ctrlWrapper(deletePlantPart),
);

export default router;
