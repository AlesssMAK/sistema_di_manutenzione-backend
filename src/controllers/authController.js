import createHttpError from 'http-errors';
import { User } from '../models/user.js';
import bcrypt from 'bcrypt';
import { createSession, setSessionCookies } from '../services/auth.js';
import { Session } from '../models/session.js';
import { logEvent } from '../services/auditLog.js';

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

  // Admin creates users through this endpoint (route gates on
  // requireAdmin) — credit the admin as the actor.
  logEvent({
    actorId: req.user?._id ?? null,
    actorRole: req.user?.role ?? 'system',
    action: 'user.create',
    targetType: 'User',
    targetId: newUser._id,
    summary: `Registered ${newUser.fullName} (${newUser.role})`,
    req,
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: newUser,
  });
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

    if (user.status === 'deactivated') {
      return res.status(403).json({ message: 'User is deactivated' });
    }

    await Session.deleteOne({ userId: user._id });
    const newSession = await createSession(user._id);
    setSessionCookies(res, newSession);

    // Operator login is audited here (auth/login bypasses the
    // authenticate middleware so req.user isn't set — pass actor
    // info explicitly via logEvent rather than logFromRequest).
    logEvent({
      actorId: user._id,
      actorRole: user.role,
      action: 'auth.login',
      targetType: 'User',
      targetId: user._id,
      summary: `${user.fullName} (${user.role}) signed in`,
      req,
    });

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

    if (user.status === 'deactivated') {
      return res.status(403).json({ message: 'User is deactivated' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw createHttpError(401, 'Invalid credentials');
    }

    await Session.deleteOne({ userId: user._id });
    const newSession = await createSession(user._id);
    setSessionCookies(res, newSession);

    logEvent({
      actorId: user._id,
      actorRole: user.role,
      action: 'auth.login',
      targetType: 'User',
      targetId: user._id,
      summary: `${user.fullName} (${user.role}) signed in`,
      req,
    });

    // Critical `return` — without it execution fell through to the
    // `throw createHttpError(400)` below AFTER a successful 200
    // response had already been sent. The error handler then tried
    // to overwrite the response with 400 (ERR_HTTP_HEADERS_SENT)
    // and pino-http logged the rewritten status code, making BE
    // look like every login was 400 while clients received 200.
    return res.status(200).json({
      user,
      mustChangePassword: user.isFirstLogin,
    });
  }

  throw createHttpError(400, 'Invalid login payload');
};

// export const registerOperator = async (req, res) => {
//   const {
//     name,
//     email,
//     role = 'operator',
//     personalCode,
//     lastName,
//     phone,
//   } = req.body;

//   const defaultPassword = '11111';

//   const hashedPassword = await bcrypt.hash(defaultPassword, 10);

//   const newUser = await User.create({
//     name,
//     email,
//     role,
//     personalCode,
//     password: hashedPassword, // В базе будет хэш от "11111"
//     isFirstLogin: true,
//     lastName,
//     phone,
//   });

//   res.status(201).json(newUser);
// };

export const logoutUser = async (req, res) => {
  const { sessionId } = req.cookies;

  // Resolve the user from the session BEFORE deleting it so the
  // audit entry knows who's signing out — the route doesn't go
  // through `authenticate`, so req.user is empty.
  let session = null;
  if (sessionId) {
    session = await Session.findById(sessionId);
    await Session.deleteOne({ _id: sessionId });
  }

  res.clearCookie('sessionId');
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  if (session?.userId) {
    const user = await User.findById(session.userId).lean();
    if (user) {
      logEvent({
        actorId: user._id,
        actorRole: user.role,
        action: 'auth.logout',
        targetType: 'User',
        targetId: user._id,
        summary: `${user.fullName} (${user.role}) signed out`,
        req,
      });
    }
  }

  res.status(204).send();
};
