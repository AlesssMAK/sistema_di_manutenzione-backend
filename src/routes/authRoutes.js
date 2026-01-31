import { Router } from 'express';
import { celebrate } from 'celebrate';
import { registerUserSchema } from '../validations/authValidation.js';
import { registerUser } from '../controllers/authController.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import { authLimiter } from '../middleware/rateLimitAuth.js';

const router = Router();

///без админа - нужно добавить админа
router.post(
  '/auth/register',
  authLimiter,
  celebrate(registerUserSchema),
  ctrlWrapper(registerUser),
);
export default router;
