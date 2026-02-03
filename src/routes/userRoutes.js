import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import { updateProfile } from '../controllers/userController.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
const router = Router();
router.patch(
  '/users/:userId',
  authenticate,
  requireAdmin,
  ctrlWrapper(updateProfile),
);
export default router;
