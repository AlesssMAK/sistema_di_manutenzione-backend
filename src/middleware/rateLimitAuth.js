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
