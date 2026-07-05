import createHttpError from 'http-errors';
import crypto from 'node:crypto';
import { User } from '../models/user.js';
import bcrypt from 'bcrypt';
import { createSession, setSessionCookies } from '../services/auth.js';
import { Session } from '../models/session.js';
import { logEvent } from '../services/auditLog.js';
import { sendPasswordResetEmail } from '../services/email/index.js';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const FRONTEND_URL = () => process.env.FRONTEND_URL ?? 'http://localhost:3000';
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

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

// Self-service reset — step 1: request a link. Always returns the same
// generic 200 so the endpoint can't be used to probe which emails exist.
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const generic = {
    message:
      'Se esiste un account con questa email, ti abbiamo inviato un link per reimpostare la password.',
  };

  // Operators have no password, so they're excluded by role.
  const user = await User.findOne({
    email,
    role: { $ne: 'operator' },
    status: 'active',
  });

  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = sha256(rawToken);
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const link = `${FRONTEND_URL()}/reset-password?token=${rawToken}`;
    // Fire-and-forget — never surface transport errors to the caller
    // (that would leak whether the address / SMTP is reachable).
    sendPasswordResetEmail(user, link).catch((err) =>
      console.error('[auth] reset email failed', err?.message),
    );

    logEvent({
      actorId: user._id,
      actorRole: user.role,
      action: 'auth.passwordResetRequested',
      targetType: 'User',
      targetId: user._id,
      summary: `${user.fullName} requested a password reset`,
      req,
    });
  }

  return res.status(200).json(generic);
};

// Self-service reset — step 2: consume the token, set the new password.
export const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  const user = await User.findOne({
    resetPasswordToken: sha256(token),
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!user) {
    throw createHttpError(400, 'Invalid or expired token');
  }

  user.password = await bcrypt.hash(password, 10);
  user.resetPasswordToken = undefined; // single-use
  user.resetPasswordExpires = undefined;
  user.isFirstLogin = false;
  await user.save();

  // A reset invalidates any active session for that user.
  await Session.deleteMany({ userId: user._id });

  logEvent({
    actorId: user._id,
    actorRole: user.role,
    action: 'auth.passwordReset',
    targetType: 'User',
    targetId: user._id,
    summary: `${user.fullName} (${user.role}) reset their password`,
    req,
  });

  return res.status(200).json({ message: 'Password reimpostata con successo' });
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
