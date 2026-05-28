import { Server } from 'socket.io';
import { socketAuth } from './auth.js';
import { joinDefaultRooms, registerRoomHandlers } from './rooms.js';

let io = null;

export const initSocket = (httpServer) => {
  const origin = process.env.SOCKET_CORS_ORIGIN?.split(',').map((s) => s.trim()) ?? [
    'http://localhost:3000',
  ];

  io = new Server(httpServer, {
    cors: { origin, credentials: true },
  });

  io.use(socketAuth);

  io.on('connection', (socket) => {
    joinDefaultRooms(socket);
    registerRoomHandlers(socket);
    console.log(
      `[socket] connected ${socket.id} user=${socket.data.user?._id} role=${socket.data.user?.role}`,
    );

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected ${socket.id} reason=${reason}`);
    });
  });

  return io;
};

export const getIO = () => io;
