import { Router } from 'express';
import { createPlantSchema } from '../validations/plantValidation.js';
import { celebrate } from 'celebrate';
import { createPlant } from '../controllers/plantController.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
const router = Router();

router.post(
  '/plants',
  authenticate,
  requireAdmin,
  celebrate(createPlantSchema),
  createPlant,
);
export default router;
