import { Router } from 'express';
import {
  getNewFaultId,
  getNewPassword,
  getNewPersonalCode,
} from '../controllers/generatorsController.js';

const router = Router();

router.get('/generate/id', getNewFaultId);

router.get('/generate/personal-code', getNewPersonalCode);

router.get('/generate/password', getNewPassword);

export default router;
