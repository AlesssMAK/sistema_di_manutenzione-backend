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
// Receiving direct messages is open to everyone (operators included) — the
// send permission (`permissions.canSendMessages`) only gates SENDING, not
// the inbox. The "sent" box is naturally empty for a user who can't send.
export const listInbox = async (req, res) => {
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
    // recipientId is populated too so the FE can show a direction label
    // ("A: <name>") on sent messages when box=all.
    populateAuthor(
      Message.find(filter).sort({ createdAt: -1 }).skip(skip).limit(perPage),
    )
      .populate({ path: 'recipientId', select: 'fullName role' })
      .lean(),
  ]);

  return res.status(200).json({
    page,
    perPage,
    total,
    totalPages: Math.ceil(total / perPage),
    items,
  });
};

// ---------- GET /messages/:id/thread ----------
// Returns the whole conversation the :id belongs to — the thread root
// (walked up via replyToId) plus every reply beneath it (walked down),
// oldest-first, so the FE can render it as a chat. Only messages the
// requester is a party to are returned, so a broadcast recipient never
// sees another recipient's private replies to the author.
export const getThread = async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const role = req.user.role;

  const idOf = (v) =>
    v && typeof v === 'object' && v._id ? String(v._id) : String(v);

  const isParty = (m) => {
    if (m.type === MESSAGE_TYPE.DIRECT) {
      return (
        idOf(m.authorId) === String(userId) ||
        idOf(m.recipientId) === String(userId)
      );
    }
    if (m.type === MESSAGE_TYPE.BROADCAST_ROLE) {
      return m.targetRole === role || idOf(m.authorId) === String(userId);
    }
    return true; // broadcast_all → everyone
  };

  const anchor = await Message.findById(id);
  if (!anchor) throw createHttpError(404, 'Message not found');
  if (!isParty(anchor)) {
    throw createHttpError(403, 'Not allowed to view this conversation');
  }

  // Thread = root (walked up via replyToId) + every reply beneath it. A
  // brand-new message has no replyToId, so it is its own thread; only
  // replies extend it. Filtered to messages the requester is a party to.
  let root = anchor;
  const seen = new Set([String(root._id)]);
  while (root.replyToId) {
    const parent = await Message.findById(root.replyToId);
    if (!parent || seen.has(String(parent._id))) break;
    seen.add(String(parent._id));
    root = parent;
  }

  const ids = [root._id];
  const collected = new Set([String(root._id)]);
  let frontier = [root._id];
  while (frontier.length) {
    const children = await Message.find(
      { replyToId: { $in: frontier } },
      '_id',
    ).lean();
    frontier = [];
    for (const c of children) {
      if (!collected.has(String(c._id))) {
        collected.add(String(c._id));
        ids.push(c._id);
        frontier.push(c._id);
      }
    }
  }

  const messages = await populateAuthor(
    Message.find({ _id: { $in: ids } }).sort({ createdAt: 1 }),
  )
    .populate({ path: 'recipientId', select: 'fullName role' })
    .lean();

  return res.status(200).json({ items: messages.filter(isParty) });
};

// ---------- GET /messages/conversations ----------
// Chat-list view of the direct inbox: one entry per counterpart with the
// latest message and the unread count, newest first.
export const listConversations = async (req, res) => {
  // Open to everyone — receiving direct messages isn't gated by the send
  // permission (see listInbox).
  const { page, perPage } = req.query;
  const me = new mongoose.Types.ObjectId(String(req.user._id));

  const result = await Message.aggregate([
    {
      $match: {
        type: MESSAGE_TYPE.DIRECT,
        $or: [{ authorId: me }, { recipientId: me }],
      },
    },
    // Resolve each message's thread root by following replyToId up the
    // chain; a message with no replyToId is its own root. This is what
    // makes a brand-new message a separate topic from an earlier one.
    {
      $graphLookup: {
        from: 'messages',
        startWith: '$replyToId',
        connectFromField: 'replyToId',
        connectToField: '_id',
        as: 'ancestors',
      },
    },
    {
      $addFields: {
        rootId: {
          $let: {
            vars: {
              rootAnc: {
                $first: {
                  $filter: {
                    input: '$ancestors',
                    as: 'a',
                    cond: { $eq: ['$$a.replyToId', null] },
                  },
                },
              },
            },
            in: { $ifNull: ['$$rootAnc._id', '$_id'] },
          },
        },
        counterpart: {
          $cond: [{ $eq: ['$authorId', me] }, '$recipientId', '$authorId'],
        },
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$rootId',
        last: { $first: '$$ROOT' },
        counterpart: { $first: '$counterpart' },
        // Oldest message in the sorted stream = the thread root → its
        // subject is the topic title.
        subject: { $last: '$subject' },
        unread: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$recipientId', me] },
                  { $not: [{ $in: [me, { $ifNull: ['$readBy', []] }] }] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { 'last.createdAt': -1 } },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * perPage },
          { $limit: perPage },
          {
            $lookup: {
              from: 'users',
              localField: 'counterpart',
              foreignField: '_id',
              as: 'user',
            },
          },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              threadId: '$_id',
              subject: 1,
              counterpart: {
                _id: '$counterpart',
                fullName: '$user.fullName',
                role: '$user.role',
              },
              unread: 1,
              last: {
                _id: '$last._id',
                subject: '$last.subject',
                body: '$last.body',
                createdAt: '$last.createdAt',
                authorId: '$last.authorId',
              },
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  const data = result[0] ?? { items: [], total: [] };
  const total = data.total[0]?.count ?? 0;

  return res.status(200).json({
    page,
    perPage,
    total,
    totalPages: Math.ceil(total / perPage),
    items: data.items,
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

  // Direct unread is counted for everyone, operators included — they receive
  // direct messages too (only sending is gated), so their dashboard badge
  // must reflect unread personal messages.
  const directFilter = {
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
    Message.countDocuments(directFilter),
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

  // Replying is sending, so it stays behind the send permission: operators
  // may READ any message but only reply when allowed to send.
  const canSend =
    userRole !== 'operator' || req.user.permissions?.canSendMessages === true;
  if (!canSend) {
    throw createHttpError(403, 'Not allowed to send direct messages');
  }

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

// ---------- DELETE /messages/:id/thread ----------
// Wipes the whole conversation the :id belongs to (root + every reply).
// For a direct thread either participant of the root (or an admin) may
// delete it; for a broadcast thread only the broadcaster (root author)
// or an admin may. This is the only path that removes another user's
// messages, and it is scoped to the shared conversation.
export const deleteThread = async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const isAdmin = req.user.role === 'admin';

  const idOf = (v) =>
    v && typeof v === 'object' && v._id ? String(v._id) : String(v);

  const anchor = await Message.findById(id);
  if (!anchor) throw createHttpError(404, 'Message not found');

  // Walk up to the thread root.
  let root = anchor;
  const seen = new Set([String(root._id)]);
  while (root.replyToId) {
    const parent = await Message.findById(root.replyToId);
    if (!parent || seen.has(String(parent._id))) break;
    seen.add(String(parent._id));
    root = parent;
  }

  // Direct → either participant of the root may wipe the topic; broadcast
  // → only the broadcaster (root author) or an admin.
  const allowed =
    isAdmin ||
    idOf(root.authorId) === String(userId) ||
    (root.type === MESSAGE_TYPE.DIRECT &&
      idOf(root.recipientId) === String(userId));
  if (!allowed) {
    throw createHttpError(403, 'Not allowed to delete this conversation');
  }

  // Breadth-first down to collect every message in the thread.
  const ids = [root._id];
  const collected = new Set([String(root._id)]);
  let frontier = [root._id];
  while (frontier.length) {
    const children = await Message.find(
      { replyToId: { $in: frontier } },
      '_id',
    ).lean();
    frontier = [];
    for (const c of children) {
      if (!collected.has(String(c._id))) {
        collected.add(String(c._id));
        ids.push(c._id);
        frontier.push(c._id);
      }
    }
  }

  const result = await Message.deleteMany({ _id: { $in: ids } });

  logFromRequest(req, {
    action: 'message.delete',
    targetType: 'Message',
    targetId: new mongoose.Types.ObjectId(String(root._id)),
    summary: `deleted thread (${result.deletedCount} messages)`,
    meta: { thread: true, count: result.deletedCount },
  });

  return res.status(200).json({ deletedCount: result.deletedCount });
};
