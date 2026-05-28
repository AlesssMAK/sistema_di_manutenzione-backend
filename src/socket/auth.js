import { parse as parseCookie } from 'cookie';
import { Session } from '../models/session.js';
import { User } from '../models/user.js';

export const socketAuth = async (socket, next) => {
  try {
    const rawCookie = socket.handshake.headers.cookie || '';
    const cookies = parseCookie(rawCookie);
    const accessToken =
      cookies.accessToken || socket.handshake.auth?.accessToken;

    if (!accessToken) {
      return next(new Error('Missing access token'));
    }

    const session = await Session.findOne({ accessToken });
    if (!session) {
      return next(new Error('Session not found'));
    }

    if (new Date() > new Date(session.accessTokenValidUntil)) {
      return next(new Error('Access token expired'));
    }

    const user = await User.findById(session.userId).lean();
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.data.user = {
      _id: String(user._id),
      role: user.role,
      name: user.name,
      lastname: user.lastname,
    };
    socket.data.sessionId = String(session._id);

    return next();
  } catch (err) {
    return next(new Error(`Socket auth failed: ${err.message}`));
  }
};
