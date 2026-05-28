export const userRoom = (userId) => `user:${userId}`;
export const roleRoom = (role) => `role:${role}`;
export const faultRoom = (faultId) => `fault:${faultId}`;
export const BROADCAST_ROOM = 'broadcast:all';

export const joinDefaultRooms = (socket) => {
  const user = socket.data.user;
  if (!user) return;
  socket.join(userRoom(user._id));
  socket.join(roleRoom(user.role));
  socket.join(BROADCAST_ROOM);
};

const FAULT_ID_RE = /^[a-f\d]{24}$/i;

export const registerRoomHandlers = (socket) => {
  socket.on('fault:subscribe', (faultId) => {
    if (typeof faultId !== 'string' || !FAULT_ID_RE.test(faultId)) return;
    socket.join(faultRoom(faultId));
  });

  socket.on('fault:unsubscribe', (faultId) => {
    if (typeof faultId !== 'string' || !FAULT_ID_RE.test(faultId)) return;
    socket.leave(faultRoom(faultId));
  });
};
