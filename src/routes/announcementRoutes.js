import { Router } from 'express';
import { celebrate } from 'celebrate';

import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { upload } from '../middleware/multer.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';

import {
  listPublicAnnouncementsSchema,
  createAnnouncementSchema,
  announcementIdParamsSchema,
} from '../validations/announcementValidation.js';

import {
  listPublicAnnouncements,
  listAnnouncementAuthors,
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

// Admin-only — list users granted the create right (for the settings UI).
router.get(
  '/announcements/authors',
  authenticate,
  authorizeRoles('admin'),
  ctrlWrapper(listAnnouncementAuthors),
);

// Admin always; any other role only if granted
// User.permissions.canCreateAnnouncements (enforced in the controller).
// multer runs BEFORE celebrate so multipart text fields land in
// req.body for the Joi validators; photo files go to req.files.
router.post(
  '/announcements',
  authenticate,
  upload.array('img', 5),
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
