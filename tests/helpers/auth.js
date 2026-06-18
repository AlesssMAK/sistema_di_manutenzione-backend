import request from 'supertest';
import { createUser } from './fixtures.js';

/**
 * Log a user in via the real /auth/login endpoint and return a
 * supertest agent that carries the session cookies on every
 * subsequent request — same as what the real frontend does after
 * a successful login.
 *
 * For operators we send `fullName + personalCode` because that's
 * what the controller branches on; for every other role we send
 * `email + password`.
 */
export const loginAs = async (app, { user, password }) => {
  const agent = request.agent(app);
  const payload =
    user.role === 'operator'
      ? { fullName: user.fullName, personalCode: user.personalCode }
      : { email: user.email, password };
  const res = await agent.post('/auth/login').send(payload);
  if (res.status !== 200) {
    throw new Error(
      `loginAs(${user.role}) failed with ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }
  return agent;
};

/**
 * Convenience — create a fresh user of the given role and return
 * an authenticated supertest agent for them. Use when the test
 * doesn't care about the specific identity, just the role.
 */
export const authenticatedAgent = async (app, role, overrides = {}) => {
  const created = await createUser({ role, ...overrides });
  return { agent: await loginAs(app, created), user: created.user };
};
