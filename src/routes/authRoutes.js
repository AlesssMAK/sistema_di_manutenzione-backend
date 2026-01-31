import { Router } from 'express';
import { celebrate } from 'celebrate';
import {
  registerUserSchema,
  loginUserSchema,
} from '../validations/authValidation.js';
import {
  registerUser,
  refreshUserSession,
  loginUser,
} from '../controllers/authController.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import { authLimiter } from '../middleware/rateLimitAuth.js';
// import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

router.post(
  '/auth/register',
  authLimiter,

  // requireAdmin,
  celebrate(registerUserSchema),
  ctrlWrapper(registerUser),
);

router.post('/auth/refresh', refreshUserSession);
router.post('/auth/login', celebrate(loginUserSchema), loginUser);

export default router;
