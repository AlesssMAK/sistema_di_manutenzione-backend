import crypto from 'crypto';
import { FIFTEEN_MINUTES, THIRTY_DAYS } from '../constants/time.js';
import { Session } from '../models/session.js';

const isProd = process.env.NODE_ENV === 'production';

export const createSession = async (userId) => {
  const accessToken = crypto.randomBytes(30).toString('base64');
  const refreshToken = crypto.randomBytes(30).toString('base64');

  return Session.create({
    userId,
    accessToken,
    refreshToken,
    accessTokenValidUntil: new Date(Date.now() + FIFTEEN_MINUTES),
    refreshTokenValidUntil: new Date(Date.now() + THIRTY_DAYS),
  });
};
export const setSessionCookies = (res, session) => {
  // Mirror what clearSessionCookies already does — secure +
  // sameSite='none' only in production. Hard-coding them broke any
  // non-https client (supertest in tests, plain-HTTP curl during
  // local dev — browsers exempt localhost but only the browser).
  const baseOptions = { httpOnly: true };
  if (isProd) {
    baseOptions.secure = true;
    baseOptions.sameSite = 'none';
  }

  res.cookie('accessToken', session.accessToken, {
    ...baseOptions,
    maxAge: FIFTEEN_MINUTES,
  });
  res.cookie('refreshToken', session.refreshToken, {
    ...baseOptions,
    maxAge: THIRTY_DAYS,
  });
  res.cookie('sessionId', session._id, {
    ...baseOptions,
    maxAge: THIRTY_DAYS,
  });
};
export const clearSessionCookies = (res) => {
  const cookieOptions = { httpOnly: true, path: '/' };
  if (isProd) {
    cookieOptions.secure = true;
    cookieOptions.sameSite = 'none';
  }
  res.clearCookie('sessionId', cookieOptions);
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
};
