import { Router } from 'express';
import { celebrate } from 'celebrate';

import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';

import {
  listPublicAnnouncementsSchema,
  createAnnouncementSchema,
  announcementIdParamsSchema,
} from '../validations/announcementValidation.js';

import {
  listPublicAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
} from '../controllers/announcementController.js';

const router = Router();

// Public — anyone can read the board, no authentication.
router.get(
  '/public/announcements',
  celebrate(listPublicAnnouncementsSchema),
  ctrlWrapper(listPublicAnnouncements),
);

// Phase 1: only admin/manager may publish. Phase 2 will move this to a
// per-user permission (User.permissions.canCreateAnnouncements).
router.post(
  '/announcements',
  authenticate,
  authorizeRoles('admin', 'manager'),
  celebrate(createAnnouncementSchema),
  ctrlWrapper(createAnnouncement),
);

// Author or admin can remove; the controller enforces the fine check.
router.delete(
  '/announcements/:id',
  authenticate,
  celebrate(announcementIdParamsSchema),
  ctrlWrapper(deleteAnnouncement),
);

export default router;
