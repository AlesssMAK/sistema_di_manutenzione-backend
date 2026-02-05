import { Router } from 'express';
const router = Router();

router.post('/plants', celebrate(createPlantSchema), createPlant);
export default router;
