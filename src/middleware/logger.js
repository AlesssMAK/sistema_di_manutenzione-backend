import pino from 'pino-http';

const isProd = process.env.NODE_ENV === 'production';

// pino-pretty is a dev-only transport (a devDependency). In production
// devDependencies aren't installed, so fall back to pino's default JSON
// logging there — otherwise startup crashes with
// "unable to determine transport target for pino-pretty".
export const logger = pino({
  level: 'info',
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
            messageFormat:
              '{req.method} {req.url} {res.statusCode} - {responseTime}ms',
            hideObject: true,
          },
        },
      }),
});
