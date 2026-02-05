import { Router } from 'express';
import { createPlantSchema } from '../validations/plantValidation.js';
import { celebrate } from 'celebrate';
import { createPlant, getAllPlants } from '../controllers/plantController.js';
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
export default router;
