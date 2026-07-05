import { Router } from 'express';
import { celebrate } from 'celebrate';
import {
  registerUserSchema,
  loginUserSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validations/authValidation.js';
import {
  registerUser,
  refreshUserSession,
  loginUser,
  forgotPassword,
  resetPassword,
  logoutUser,
} from '../controllers/authController.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import { authLimiter } from '../middleware/rateLimitAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.post(
  '/auth/register',
  authenticate,
  authLimiter,
  requireAdmin,
  celebrate(registerUserSchema),
  ctrlWrapper(registerUser),
);

router.post('/auth/refresh', refreshUserSession);
router.post('/auth/login', celebrate(loginUserSchema), loginUser);

// Public self-service password reset (email + password roles only).
router.post(
  '/auth/forgot-password',
  authLimiter,
  celebrate(forgotPasswordSchema),
  ctrlWrapper(forgotPassword),
);
router.post(
  '/auth/reset-password',
  authLimiter,
  celebrate(resetPasswordSchema),
  ctrlWrapper(resetPassword),
);

router.post('/auth/logout', logoutUser);

export default router;
