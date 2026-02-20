import { celebrate } from 'celebrate';
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
const router = Router();

router.post(
  '/:plantId/:partId/anomalia',
  authenticate,
  celebrate(createAnomalia),
  createAnomaliaByOperator,
);
export default router;
