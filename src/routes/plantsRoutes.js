import { Router } from 'express';
import { createPlantSchema } from '../validations/plantValidation.js';
import { celebrate } from 'celebrate';
import { createPlant } from '../controllers/plantController.js';
const router = Router();

router.post('/plants', celebrate(createPlantSchema), createPlant);
export default router;
