import { Router } from 'express';
import { getNewFaultId } from '../controllers/generateFaultIdRoute.js';

const router = Router();

router.get('/generate-id', getNewFaultId);

export default router;
