import { HttpError } from 'http-errors';

export const errorHandler = (err, req, res, next) => {
  if (err instanceof HttpError) {
    // 4xx is user-facing intent (404, 409, …) — surfacing it as an
    // application error spams logs without signal.
    return res.status(err.status).json({
      message: err.message || err.name,
    });
  }

  // Real 5xx — log enough to investigate but skip stack noise on
  // common request issues.
  console.error('[error-handler]', err);

  const isProd = process.env.NODE_ENV === 'production';

  res.status(500).json({
    message: isProd
      ? 'Something went wrong. Please try again later.'
      : err.message,
  });
};
