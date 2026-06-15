import { Router } from 'express';
import { getAllOperators } from '../controllers/operatorController.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';

const router = Router();

router.get('/operators', ctrlWrapper(getAllOperators));

export default router;
