import createHttpError from 'http-errors';

export const authorizeRoles =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw createHttpError(403, 'Access denied');
    }
    next();
  };
