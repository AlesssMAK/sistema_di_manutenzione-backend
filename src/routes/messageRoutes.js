import { Router } from 'express';
import { celebrate } from 'celebrate';

import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { upload } from '../middleware/multer.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';

import {
  createDirectMessageSchema,
  createBroadcastSchema,
  listInboxSchema,
  listAnnouncementsSchema,
  messageIdParamsSchema,
  replyMessageSchema,
} from '../validations/messageValidation.js';

import {
  createDirectMessage,
  createBroadcast,
  listInbox,
  listAnnouncements,
  listAllowedSenders,
  getUnreadCount,
  markAsRead,
  replyToMessage,
  deleteMessage,
} from '../controllers/messageController.js';

const router = Router();

router.use('/messages', authenticate);

// multer runs BEFORE celebrate so multipart text fields are parsed
// into req.body before the Joi validators read them; the 5-file cap
// here matches the limit baked into the model + UploadImages UI.
router.post(
  '/messages/direct',
  upload.array('img', 5),
  celebrate(createDirectMessageSchema),
  ctrlWrapper(createDirectMessage),
);

router.post(
  '/messages/broadcast',
  upload.array('img', 5),
  celebrate(createBroadcastSchema),
  ctrlWrapper(createBroadcast),
);

router.get(
  '/messages/inbox',
  celebrate(listInboxSchema),
  ctrlWrapper(listInbox),
);

router.get(
  '/messages/announcements',
  celebrate(listAnnouncementsSchema),
  ctrlWrapper(listAnnouncements),
);

router.get('/messages/unread-count', ctrlWrapper(getUnreadCount));

router.get(
  '/messages/allowed-senders',
  authorizeRoles('admin'),
  ctrlWrapper(listAllowedSenders),
);

router.patch(
  '/messages/:id/read',
  celebrate(messageIdParamsSchema),
  ctrlWrapper(markAsRead),
);

router.post(
  '/messages/:id/reply',
  upload.array('img', 5),
  celebrate(replyMessageSchema),
  ctrlWrapper(replyToMessage),
);

router.delete(
  '/messages/:id',
  celebrate(messageIdParamsSchema),
  ctrlWrapper(deleteMessage),
);

export default router;
