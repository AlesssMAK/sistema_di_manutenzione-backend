import createHttpError from 'http-errors';
import mongoose from 'mongoose';

import { MESSAGE_TYPE } from '../constants/message.js';
import { STATUS } from '../constants/status.js';
import { Message } from '../models/message.js';
import { saveFileToCloudinary } from '../utils/saveFileToCloudinary.js';

// Upload every multer-buffered image to Cloudinary and return the
// secure URLs in the same order the FE sent them. Returns [] when
// no files are attached so callers can splice straight into the
// Message.create payload without branching.
const uploadAttachments = async (req) => {
  if (!req.files || req.files.length === 0) return [];
  const urls = [];
  for (const file of req.files) {
    const result = await saveFileToCloudinary(file.buffer, 'messages');
    urls.push(result.secure_url);
  }
  return urls;
};
import { User } from '../models/user.js';

import { logFromRequest } from '../services/auditLog.js';
import { sendDirectMessageEmail } from '../services/email/index.js';
import { sendPushToUser } from '../services/push/index.js';
import { computeBroadcastExpireAt } from '../services/message.js';
import { getSettings } from '../services/systemSettings.js';
import { emitMessageNew } from '../socket/emitters.js';

const populateAuthor = (q) =>
  q.populate({ path: 'authorId', select: 'fullName role avatar' });

// ---------- GET /messages/allowed-senders (admin) ----------
// Operators explicitly granted direct messaging — drives the settings
// UI chips. Other roles can always message, so they're not listed.
export const listAllowedSenders = async (req, res) => {
  const users = await User.find(
    { role: 'operator', 'permissions.canSendMessages': true },
    '_id fullName role',
  )
    .sort({ fullName: 1 })
    .lean();
  res.status(200).json({ users });
};

// ---------- POST /messages/direct ----------
export const createDirectMessage = async (req, res) => {
  const canSend =
    req.user.role !== 'operator' ||
    req.user.permissions?.canSendMessages === true;
  if (!canSend) {
    throw createHttpError(403, 'Not allowed to send direct messages');
  }

  const { recipientId, subject, body } = req.body;

  if (String(recipientId) === String(req.user._id)) {
    throw createHttpError(400, 'Cannot send a direct message to yourself');
  }

  const recipient = await User.findById(recipientId).lean();
  if (!recipient) throw createHttpError(404, 'Recipient not found');
  if (recipient.status !== STATUS.ACTIVE) {
    throw createHttpError(400, 'Recipient is not active');
  }

  const img = await uploadAttachments(req);

  const message = await Message.create({
    type: MESSAGE_TYPE.DIRECT,
    authorId: req.user._id,
    authorName: req.user.fullName,
    authorRole: req.user.role,
    recipientId,
    subject: subject ?? '',
    body,
    img,
  });

  const populated = await populateAuthor(Message.findById(message._id)).lean();

  emitMessageNew(populated);

  setImmediate(() => {
    sendDirectMessageEmail(populated, recipient).catch((err) =>
      console.error('[email] direct message failed', err.message),
    );

    sendPushToUser(recipientId, {
      title: `Messaggio da ${req.user.fullName}`,
      body: subject || body.slice(0, 120),
      url: '/messages',
      tag: `msg-${message._id}`,
    }).catch((err) => console.error('[push] direct message failed', err.message));
  });

  logFromRequest(req, {
    action: 'message.create',
    targetType: 'Message',
    targetId: message._id,
    summary: `direct → ${recipient.email}`,
    meta: { recipientId, subject: subject ?? '' },
  });

  return res.status(201).json(populated);
};

// ---------- POST /messages/broadcast ----------
export const createBroadcast = async (req, res) => {
  const { target, targetRole, subject, body } = req.body;

  const settings = await getSettings();
  const ttlDays = settings?.messaging?.broadcastTtlDays ?? 30;
  const expireAt = computeBroadcastExpireAt(ttlDays);

  const img = await uploadAttachments(req);

  const message = await Message.create({
    type:
      target === 'role'
        ? MESSAGE_TYPE.BROADCAST_ROLE
        : MESSAGE_TYPE.BROADCAST_ALL,
    authorId: req.user._id,
    authorName: req.user.fullName,
    authorRole: req.user.role,
    targetRole: target === 'role' ? targetRole : null,
    subject: subject ?? '',
    body,
    expireAt,
    img,
  });

  const populated = await populateAuthor(Message.findById(message._id)).lean();
  emitMessageNew(populated);

  logFromRequest(req, {
    action: 'message.broadcast',
    targetType: 'Message',
    targetId: message._id,
    summary:
      target === 'role' ? `broadcast → role:${targetRole}` : 'broadcast → all',
    meta: { target, targetRole: targetRole ?? null, expireAt },
  });

  return res.status(201).json(populated);
};

// ---------- GET /messages/inbox ----------
export const listInbox = async (req, res) => {
  const canSend =
    req.user.role !== 'operator' ||
    req.user.permissions?.canSendMessages === true;
  if (!canSend) {
    throw createHttpError(403, 'No direct inbox');
  }

  const { box, page, perPage, unreadOnly } = req.query;
  const userId = req.user._id;

  const filter = { type: MESSAGE_TYPE.DIRECT };
  if (box === 'inbox') filter.recipientId = userId;
  else if (box === 'sent') filter.authorId = userId;
  else filter.$or = [{ recipientId: userId }, { authorId: userId }];

  if (unreadOnly) {
    filter.recipientId = userId;
    filter.readBy = { $ne: userId };
  }

  const skip = (page - 1) * perPage;
  const [total, items] = await Promise.all([
    Message.countDocuments(filter),
    populateAuthor(
      Message.find(filter).sort({ createdAt: -1 }).skip(skip).limit(perPage),
    ).lean(),
  ]);

  return res.status(200).json({
    page,
    perPage,
    total,
    totalPages: Math.ceil(total / perPage),
    items,
  });
};

// ---------- GET /messages/announcements ----------
export const listAnnouncements = async (req, res) => {
  const { types, page, perPage, unreadOnly } = req.query;
  const userId = req.user._id;
  const role = req.user.role;

  // Default = both broadcast_all and broadcast_role for the user's role.
  // ?types= lets clients narrow it (e.g. bell preview wants only role-targeted).
  const requestedTypes = types
    ? String(types)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [MESSAGE_TYPE.BROADCAST_ALL, MESSAGE_TYPE.BROADCAST_ROLE];

  const typeClauses = [];
  if (requestedTypes.includes(MESSAGE_TYPE.BROADCAST_ALL)) {
    typeClauses.push({ type: MESSAGE_TYPE.BROADCAST_ALL });
  }
  if (requestedTypes.includes(MESSAGE_TYPE.BROADCAST_ROLE)) {
    typeClauses.push({ type: MESSAGE_TYPE.BROADCAST_ROLE, targetRole: role });
  }

  const filter = typeClauses.length === 1 ? typeClauses[0] : { $or: typeClauses };
  if (unreadOnly) filter.readBy = { $ne: userId };

  const skip = (page - 1) * perPage;
  const [total, items] = await Promise.all([
    Message.countDocuments(filter),
    populateAuthor(
      Message.find(filter).sort({ createdAt: -1 }).skip(skip).limit(perPage),
    ).lean(),
  ]);

  return res.status(200).json({
    page,
    perPage,
    total,
    totalPages: Math.ceil(total / perPage),
    items,
  });
};

// ---------- GET /messages/unread-count ----------
// Split into three buckets so the FE can drive different UI elements:
//   - `direct`             → header bell badge contribution
//   - `roleAnnouncements`  → header bell badge contribution
//   - `allAnnouncements`   → /reports-and-communications dashboard badge
// Operators have no direct inbox (gated by listInbox), so we return 0 there.
export const getUnreadCount = async (req, res) => {
  const userId = req.user._id;
  const role = req.user.role;
  const isOperator = role === 'operator';

  const directFilter = isOperator
    ? null
    : {
        type: MESSAGE_TYPE.DIRECT,
        recipientId: userId,
        readBy: { $ne: userId },
      };

  const roleFilter = {
    type: MESSAGE_TYPE.BROADCAST_ROLE,
    targetRole: role,
    readBy: { $ne: userId },
  };

  const allFilter = {
    type: MESSAGE_TYPE.BROADCAST_ALL,
    readBy: { $ne: userId },
  };

  const [direct, roleAnnouncements, allAnnouncements] = await Promise.all([
    directFilter ? Message.countDocuments(directFilter) : Promise.resolve(0),
    Message.countDocuments(roleFilter),
    Message.countDocuments(allFilter),
  ]);

  return res.status(200).json({ direct, roleAnnouncements, allAnnouncements });
};

// ---------- PATCH /messages/:id/read ----------
export const markAsRead = async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const message = await Message.findById(id);
  if (!message) throw createHttpError(404, 'Message not found');

  // Authorization: direct only by recipient; broadcasts by anyone the
  // broadcast targets (broadcast_all → everyone; broadcast_role → that role).
  if (message.type === MESSAGE_TYPE.DIRECT) {
    if (String(message.recipientId) !== String(userId)) {
      throw createHttpError(403, 'Not your message');
    }
  } else if (message.type === MESSAGE_TYPE.BROADCAST_ROLE) {
    if (message.targetRole !== req.user.role) {
      throw createHttpError(403, 'Broadcast not addressed to your role');
    }
  }

  await Message.updateOne({ _id: id }, { $addToSet: { readBy: userId } });
  const updated = await populateAuthor(Message.findById(id)).lean();
  return res.status(200).json(updated);
};

// ---------- POST /messages/:id/reply ----------
// Lets any user (including operators) respond to a message they received —
// direct addressed to them, broadcast_role targeting their role, or
// broadcast_all. The reply is always a new direct message back to the
// original author, with replyToId set for thread reconstruction.
export const replyToMessage = async (req, res) => {
  const { id } = req.params;
  const { subject, body } = req.body;
  const userId = req.user._id;
  const userRole = req.user.role;

  const original = await Message.findById(id);
  if (!original) throw createHttpError(404, 'Message not found');

  // Author can't reply to their own message — it'd send to themselves.
  if (String(original.authorId) === String(userId)) {
    throw createHttpError(400, 'Cannot reply to your own message');
  }

  // Type-specific authorization — only addressees can reply.
  if (original.type === MESSAGE_TYPE.DIRECT) {
    if (String(original.recipientId) !== String(userId)) {
      throw createHttpError(403, 'Not your message');
    }
  } else if (original.type === MESSAGE_TYPE.BROADCAST_ROLE) {
    if (original.targetRole !== userRole) {
      throw createHttpError(403, 'Broadcast not addressed to your role');
    }
  }
  // BROADCAST_ALL: addressed to everyone, no extra gate.

  // Original author must still be a live, active recipient.
  const recipient = await User.findById(original.authorId).lean();
  if (!recipient) {
    throw createHttpError(404, 'Original author no longer exists');
  }
  if (recipient.status !== STATUS.ACTIVE) {
    throw createHttpError(400, 'Original author is not active');
  }

  const img = await uploadAttachments(req);

  const reply = await Message.create({
    type: MESSAGE_TYPE.DIRECT,
    authorId: userId,
    authorName: req.user.fullName,
    authorRole: userRole,
    recipientId: original.authorId,
    subject: subject ?? '',
    body,
    replyToId: original._id,
    img,
  });

  const populated = await populateAuthor(Message.findById(reply._id)).lean();

  emitMessageNew(populated);

  setImmediate(() => {
    sendDirectMessageEmail(populated, recipient).catch((err) =>
      console.error('[email] reply message failed', err.message),
    );
  });

  logFromRequest(req, {
    action: 'message.reply',
    targetType: 'Message',
    targetId: reply._id,
    summary: `reply → ${recipient.email} (re: ${original._id})`,
    meta: { replyToId: original._id, originalType: original.type },
  });

  return res.status(201).json(populated);
};

// ---------- DELETE /messages/:id ----------
export const deleteMessage = async (req, res) => {
  const { id } = req.params;

  const message = await Message.findById(id);
  if (!message) throw createHttpError(404, 'Message not found');

  const isAuthor = String(message.authorId) === String(req.user._id);
  const isAdmin = req.user.role === 'admin';
  if (!isAuthor && !isAdmin) {
    throw createHttpError(403, 'Only the author or an admin can delete');
  }

  await Message.deleteOne({ _id: id });

  logFromRequest(req, {
    action: 'message.delete',
    targetType: 'Message',
    targetId: new mongoose.Types.ObjectId(id),
    summary: `deleted ${message.type}`,
    meta: { byAdmin: isAdmin && !isAuthor },
  });

  return res.status(204).end();
};
