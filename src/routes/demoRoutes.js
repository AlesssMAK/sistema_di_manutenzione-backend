import { Router } from 'express';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import { demoLogin, demoReset } from '../controllers/demoController.js';

const router = Router();

router.post('/auth/demo-login', ctrlWrapper(demoLogin));
router.post('/demo/reset', ctrlWrapper(demoReset));

export default router;
