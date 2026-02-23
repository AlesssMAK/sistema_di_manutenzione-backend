import createHttpError from 'http-errors';
import { User } from '../models/user.js';
import bcrypt from 'bcrypt';
import { createSession, setSessionCookies } from '../services/auth.js';
import { Session } from '../models/session.js';

export const registerUser = async (req, res) => {
  const { name, email, phone, password, role, lastname, personalCode } =
    req.body;

  const existingUser = await User.findOne({
    $or: [{ email }, { phone }, { personalCode: personalCode || null }],
  });

  if (existingUser) {
    if (existingUser.email === email) {
      throw createHttpError(400, 'Email address is already in use');
    }
    if (existingUser.phone === phone) {
      throw createHttpError(400, 'Phone number is already in use');
    }
    if (personalCode && existingUser.personalCode === personalCode) {
      throw createHttpError(400, 'Personal code is already in use');
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    name,
    email,
    phone,
    personalCode,
    password: hashedPassword,
    role,
    lastname,
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
    return next(createHttpError(401, 'Session not found'));
  }
  const isSessionTokenExpired =
    new Date() > new Date(session.refreshTokenValidUntil);
  if (isSessionTokenExpired) {
    return next(createHttpError(401, 'Session token expired'));
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
  const { email, personalCode, password } = req.body;
  let user;

  if (personalCode) {
    // Вхід для оператора по коду (OP001)
    user = await User.findOne({ personalCode });
  } else if (email) {
    // Вхід для адміна/менеджера
    user = await User.findOne({ email });
  }

  if (!user) {
    return next(createHttpError(401, 'User not found'));
  }

  // Проверка пароля (для первого входа оператора это будет "11111")
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return next(createHttpError(401, 'Invalid credentials'));
  }

  if (user.role === 'operator' && user.isFirstLogin) {
    // Можно либо сразу залогинить, либо выдать спец. статус
  }

  await Session.deleteOne({ userId: user._id });
  const newSession = await createSession(user._id);
  setSessionCookies(res, newSession);

  res.status(200).json({
    user,
    mustChangePassword: user.isFirstLogin,
  });
};

export const registerOperator = async (req, res) => {
  const {
    name,
    email,
    role = 'operator',
    personalCode,
    lastname,
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
    lastname,
    phone,
  });

  res.status(201).json(newUser);
};
