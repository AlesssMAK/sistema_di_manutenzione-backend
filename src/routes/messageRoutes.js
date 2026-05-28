import { Router } from 'express';
import { celebrate } from 'celebrate';

import { authenticate } from '../middleware/authenticate.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';

import {
  createDirectMessageSchema,
  createBroadcastSchema,
  listInboxSchema,
  listAnnouncementsSchema,
  messageIdParamsSchema,
} from '../validations/messageValidation.js';

import {
  createDirectMessage,
  createBroadcast,
  listInbox,
  listAnnouncements,
  getUnreadCount,
  markAsRead,
  deleteMessage,
} from '../controllers/messageController.js';

const router = Router();

router.use('/messages', authenticate);

router.post(
  '/messages/direct',
  celebrate(createDirectMessageSchema),
  ctrlWrapper(createDirectMessage),
);

router.post(
  '/messages/broadcast',
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

router.patch(
  '/messages/:id/read',
  celebrate(messageIdParamsSchema),
  ctrlWrapper(markAsRead),
);

router.delete(
  '/messages/:id',
  celebrate(messageIdParamsSchema),
  ctrlWrapper(deleteMessage),
);

export default router;
