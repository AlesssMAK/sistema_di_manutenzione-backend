import { Router } from 'express';
import { getHistoryFault } from '../controllers/historyController.js';
import { authenticate } from '../middleware/authenticate.js';
const router = Router();

router.get('/history/:faultId', authenticate, getHistoryFault);

export default router;
