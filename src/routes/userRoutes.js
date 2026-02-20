import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import { updateProfile, getAllUsers } from '../controllers/userController.js';
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
router.get('/users', ctrlWrapper(getAllUsers));
export default router;
