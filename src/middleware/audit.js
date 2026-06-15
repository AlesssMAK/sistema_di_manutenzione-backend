import { logFromRequest } from '../services/auditLog.js';

const safeCall = (fn, req, res) => {
  if (typeof fn !== 'function') return fn ?? null;
  try {
    return fn(req, res);
  } catch (err) {
    console.error('[audit middleware] resolver threw', err.message);
    return null;
  }
};

export const audit = ({
  action,
  targetType = null,
  resolveTargetId = null,
  resolveSummary = null,
  resolveMeta = null,
  successOnly = true,
}) => {
  if (!action) throw new Error('audit(): action is required');

  return (req, res, next) => {
    res.on('finish', () => {
      if (successOnly && (res.statusCode < 200 || res.statusCode >= 300)) {
        return;
      }

      const payload = {
        action,
        targetType,
        targetId: safeCall(resolveTargetId, req, res),
        summary: safeCall(resolveSummary, req, res) ?? '',
        meta: safeCall(resolveMeta, req, res),
      };

      logFromRequest(req, payload).catch((err) => {
        console.error('[audit middleware] log failed', action, err.message);
      });
    });

    next();
  };
};
