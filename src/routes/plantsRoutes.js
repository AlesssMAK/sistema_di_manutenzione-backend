import { Router } from 'express';
import {
  createPlantSchema,
  deletePlantSchema,
  updatePlantSchema,
} from '../validations/plantValidation.js';
import { celebrate } from 'celebrate';
import {
  createPlant,
  deletePlant,
  getAllPlants,
  updatePlant,
} from '../controllers/plantController.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';

const router = Router();

router.post(
  '/plants',
  authenticate,
  requireAdmin,
  celebrate(createPlantSchema),
  createPlant,
);

router.get('/plants', celebrate(createPlantSchema), ctrlWrapper(getAllPlants));

router.put(
  '/plants/:plantId',
  authenticate,
  requireAdmin,
  celebrate(updatePlantSchema),
  ctrlWrapper(updatePlant),
);

router.delete(
  '/plants/:plantId',
  authenticate,
  requireAdmin,
  celebrate(deletePlantSchema),
  ctrlWrapper(deletePlant),
);

export default router;
