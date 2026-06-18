import { buildApp } from '../../src/app.js';

/**
 * Build an Express app for tests with AdminJS + Swagger disabled.
 * AdminJS would try to connect its own MongoStore on the in-memory
 * URI (extra startup cost, noisy logs); Swagger isn't useful here.
 */
export const createTestApp = () =>
  buildApp({ withAdmin: false, withSwagger: false });
