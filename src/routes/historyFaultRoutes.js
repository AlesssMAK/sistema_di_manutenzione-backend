import { Router } from 'express';
import { getHistoryFault } from '../controllers/historyController.js';
const router = Router();

router.get('/history/faultId', getHistoryFault);

export default router;
