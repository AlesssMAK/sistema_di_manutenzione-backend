import { Router } from 'express';
import { celebrate, Joi, Segments } from 'celebrate';
import { authenticate } from '../middleware/authenticate.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import {
  updateProfile,
  getAllUsers,
  getUser,
  updateMyLocale,
} from '../controllers/userController.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();
router.patch(
  '/users/:userId',
  authenticate,
  requireAdmin,
  ctrlWrapper(updateProfile),
);

router.put(
  '/users/:userId',
  authenticate,
  requireAdmin,
  ctrlWrapper(updateProfile),
);

router.get('/users', authenticate, ctrlWrapper(getAllUsers));

router.get('/users/me', authenticate, getUser);

// Self-service language preference (drives localized emails).
router.patch(
  '/users/me/locale',
  authenticate,
  celebrate({
    [Segments.BODY]: Joi.object({
      locale: Joi.string().valid('it', 'en', 'es', 'pl').required(),
    }),
  }),
  ctrlWrapper(updateMyLocale),
);

export default router;
