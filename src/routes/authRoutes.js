import { Router } from 'express';
import { celebrate } from 'celebrate';
import { registerUserSchema } from '../validations/authValidation.js';
import { registerUser } from '../controllers/authController.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import { authLimiter } from '../middleware/rateLimitAuth.js';
// import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

///без админа - нужно добавить админа
router.post(
  '/auth/register',
  authLimiter,

  // requireAdmin,
  celebrate(registerUserSchema),
  ctrlWrapper(registerUser),
);
export default router;
