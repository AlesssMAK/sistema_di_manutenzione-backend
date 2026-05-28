import { Router } from 'express';
import { celebrate } from 'celebrate';
import { authenticate } from '../middleware/authenticate.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { updateSystemSettingsSchema } from '../validations/systemSettingsValidation.js';
import {
  getPublicSettings,
  getFullSettings,
  updateSettings,
} from '../controllers/systemSettingsController.js';

const router = Router();

router.get('/system-settings', authenticate, getPublicSettings);

router.get('/system-settings/full', authenticate, requireAdmin, getFullSettings);

router.patch(
  '/system-settings',
  authenticate,
  requireAdmin,
  celebrate(updateSystemSettingsSchema),
  updateSettings,
);

export default router;
