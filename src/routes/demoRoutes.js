import { Router } from 'express';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import { demoLogin } from '../controllers/demoController.js';

const router = Router();

router.post('/auth/demo-login', ctrlWrapper(demoLogin));

export default router;
