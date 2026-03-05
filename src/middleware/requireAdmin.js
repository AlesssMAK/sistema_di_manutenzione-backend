import createHttpError from 'http-errors';

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    throw createHttpError(403, 'Access denied');
  }
  next();
};
