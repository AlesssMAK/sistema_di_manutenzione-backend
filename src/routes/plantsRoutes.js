import { Router } from 'express';
import { createPlantSchema } from '../validations/plantValidation.js';
const router = Router();

router.post('/plants', celebrate(createPlantSchema), createPlant);
export default router;
