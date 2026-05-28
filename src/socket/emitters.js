import { getIO } from './index.js';
import {
  BROADCAST_ROOM,
  faultRoom,
  roleRoom,
  userRoom,
} from './rooms.js';

const safeEmit = (target, event, payload) => {
  try {
    const io = getIO();
    if (!io) return;
    target(io).emit(event, payload);
  } catch (err) {
    console.error(`[socket] emit ${event} failed`, err.message);
  }
};

export const emitFaultCreated = (fault) =>
  safeEmit(
    (io) => io.to(roleRoom('manager')).to(roleRoom('admin')).to(roleRoom('safety')),
    'fault:created',
    fault,
  );

export const emitFaultUpdated = (fault) =>
  safeEmit(
    (io) =>
      io
        .to(faultRoom(String(fault._id)))
        .to(roleRoom('manager'))
        .to(roleRoom('admin'))
        .to(roleRoom('safety')),
    'fault:updated',
    fault,
  );

export const emitFaultStatusChanged = (faultId, payload) =>
  safeEmit(
    (io) =>
      io
        .to(faultRoom(String(faultId)))
        .to(roleRoom('manager'))
        .to(roleRoom('admin'))
        .to(roleRoom('safety')),
    'fault:statusChanged',
    { faultId: String(faultId), ...payload },
  );

export const emitCommentCreated = (comment) =>
  safeEmit(
    (io) => io.to(faultRoom(String(comment.faultId))),
    'comment:created',
    comment,
  );

export const emitToUser = (userId, event, payload) =>
  safeEmit((io) => io.to(userRoom(String(userId))), event, payload);

export const emitBroadcast = (event, payload) =>
  safeEmit((io) => io.to(BROADCAST_ROOM), event, payload);

/**
 * Fan-out a Message to the right rooms based on its type:
 *   - direct          → user:<recipientId>
 *   - broadcast_role  → role:<targetRole>
 *   - broadcast_all   → broadcast:all
 * Also echoed to the author's own user room so the sender's other
 * tabs/devices see the message immediately.
 */
export const emitMessageNew = (message) => {
  const authorRoom = (io) => io.to(userRoom(String(message.authorId)));

  if (message.type === 'direct') {
    return safeEmit(
      (io) => authorRoom(io).to(userRoom(String(message.recipientId))),
      'message:new',
      message,
    );
  }
  if (message.type === 'broadcast_role') {
    return safeEmit(
      (io) => authorRoom(io).to(roleRoom(message.targetRole)),
      'message:new',
      message,
    );
  }
  // broadcast_all
  return safeEmit(
    (io) => authorRoom(io).to(BROADCAST_ROOM),
    'message:new',
    message,
  );
};
