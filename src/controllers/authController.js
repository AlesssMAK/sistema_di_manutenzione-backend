import createHttpError from 'http-errors';
import { User } from '../models/user.js';
import bcrypt from 'bcrypt';
import { createSession, setSessionCookies } from '../services/auth.js';
import { Session } from '../models/session.js';

export const registerUser = async (req, res) => {
  const { role, fullName, email, password, personalCode } = req.body;

  const existingUser = await User.findOne({
    $or: [{ email }, { personalCode: personalCode || null }],
  });

  if (existingUser) {
    if (existingUser.email === email) {
      if (existingUser.role !== 'operator') {
        throw createHttpError(400, 'Email address is already in use');
      }
    }
    if (personalCode && existingUser.personalCode === personalCode) {
      throw createHttpError(400, 'Personal code is already in use');
    }
  }

  let hashedPassword = null;

  if (role !== 'operator') {
    hashedPassword = await bcrypt.hash(password, 10);
  }

  const newUser = await User.create({
    fullName,
    email,
    password: role === 'operator' ? undefined : hashedPassword,
    personalCode: role === 'operator' ? personalCode : undefined,
    role,
  });
  const newSession = await createSession(newUser._id);
  setSessionCookies(res, newSession);

  res.status(201).json(newUser);
};

export const refreshUserSession = async (req, res, next) => {
  const session = await Session.findOne({
    _id: req.cookies.sessionId,
    refreshToken: req.cookies.refreshToken,
  });
  if (!session) {
    throw createHttpError(401, 'Session not found');
  }
  const isSessionTokenExpired =
    new Date() > new Date(session.refreshTokenValidUntil);
  if (isSessionTokenExpired) {
    throw createHttpError(401, 'Session token expired');
  }
  await Session.deleteOne({
    _id: req.cookies.sessionId,
    refreshToken: req.cookies.refreshToken,
  });
  const newSession = await createSession(session.userId);
  setSessionCookies(res, newSession);

  res.status(200).json({
    message: 'Successfully refreshed a session',
  });
};

///login
export const loginUser = async (req, res, next) => {
  const { fullName, email, personalCode, password } = req.body;
  let user;

  // ---------- ЛОГІН ОПЕРАТОРА (без пароля) ----------
  if (fullName && personalCode) {
    user = await User.findOne({
      fullName,
      personalCode,
      role: 'operator',
    });

    if (!user) {
      throw createHttpError(401, 'Operator not found');
    }

    await Session.deleteOne({ userId: user._id });
    const newSession = await createSession(user._id);
    setSessionCookies(res, newSession);

    return res.status(200).json({
      user,
      mustChangePassword: false,
    });
  }

  // ---------- ЛОГІН ІНШИХ РОЛЕЙ (email + password) ----------
  if (email && password) {
    user = await User.findOne({ email, role: { $ne: 'operator' } });

    if (!user) {
      throw createHttpError(401, 'User not found');
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw createHttpError(401, 'Invalid credentials');
    }

    await Session.deleteOne({ userId: user._id });
    const newSession = await createSession(user._id);
    setSessionCookies(res, newSession);

    res.status(200).json({
      user,
      mustChangePassword: user.isFirstLogin,
    });
  }

  throw createHttpError(400, 'Invalid login payload');
};

export const registerOperator = async (req, res) => {
  const {
    name,
    email,
    role = 'operator',
    personalCode,
    lastName,
    phone,
  } = req.body;

  const defaultPassword = '11111';

  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const newUser = await User.create({
    name,
    email,
    role,
    personalCode,
    password: hashedPassword, // В базе будет хэш от "11111"
    isFirstLogin: true,
    lastName,
    phone,
  });

  res.status(201).json(newUser);
};

export const logoutUser = async (req, res) => {
  const { sessionId } = req.cookies;

  if (sessionId) {
    await Session.deleteOne({ _id: sessionId });
  }

  res.clearCookie('sessionId');
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  res.status(204).send();
};
