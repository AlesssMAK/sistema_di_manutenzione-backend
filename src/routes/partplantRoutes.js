import { Router } from 'express';
import { createPartPlantSchema } from '../validations/partplantValidation.js';
import { celebrate } from 'celebrate';
import { authenticate } from '../middleware/authenticate.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { createPartPlant } from '../controllers/partPlantController.js';
const router = Router();
router.post(
  '/plants/parts',
  authenticate,
  requireAdmin,
  celebrate(createPartPlantSchema),
  createPartPlant,
);
export default router;
