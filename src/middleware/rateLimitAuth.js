import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { FIFTEEN_MINUTES } from '../constants/time.js';

export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many auth attempts from this IP. Please try again later.',
  },
  keyGenerator: (req) => ipKeyGenerator(req),
});

// Brute-force guard for the login endpoint. Unlike authLimiter, only
// FAILED logins count (skipSuccessfulRequests): a whole factory signing in
// from one shared public IP must never get locked out on success, while an
// attacker guessing passwords (repeated 4xx) is still throttled per IP.
export const loginLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many failed login attempts. Please try again later.',
  },
  keyGenerator: (req) => ipKeyGenerator(req),
});
