import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod;

export default async function setup() {
  // Disable noisy side effects: cron jobs and outbound email are
  // app-level features tested in isolation, they have no business
  // running during the rest of the suite.
  process.env.CRON_ENABLED = 'false';
  process.env.EMAIL_DRIVER = 'stub';
  process.env.NODE_ENV = 'test';
  process.env.FRONTEND_URL = 'http://localhost:3000';
  // AdminJS would try to spin up its own sessionStore against this
  // URI and we don't need the panel in tests anyway — buildApp is
  // called with { withAdmin: false } everywhere in /tests, but the
  // env vars need to exist for any module-level reads.
  process.env.ADMIN_COOKIE_SECRET = 'test-cookie-secret-do-not-use';
  process.env.ADMIN_SESSION_SECRET = 'test-session-secret-do-not-use';

  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();

  return async () => {
    await mongod?.stop();
  };
}
