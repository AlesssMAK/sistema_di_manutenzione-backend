import createHttpError from 'http-errors';
import { User } from '../models/user.js';
import { createSession, setSessionCookies } from '../services/auth.js';
import { DEMO_ROLES } from '../constants/demo.js';
import { resetAndSeedDemo } from '../demo/seedDemoData.js';

// Password-less login for the public demo. The route is mounted only
// when DEMO_MODE=true (see app.js), so this can never become an auth
// bypass in production. It reuses the normal session mechanism, so
// `authenticate` / `authorizeRoles` keep working unchanged and the real
// role-gating is still demonstrated to the visitor.
export const demoLogin = async (req, res) => {
  const { role } = req.body;

  if (!DEMO_ROLES.includes(role)) {
    throw createHttpError(400, 'Invalid demo role');
  }

  const user = await User.findOne({ role });
  if (!user) {
    throw createHttpError(
      404,
      `No demo user for role "${role}" — run "npm run seed" against the demo DB`,
    );
  }

  // Variant A: deliberately NO Session.deleteOne here. The real
  // loginUser enforces one session per user; the demo must let many
  // concurrent visitors share the same demo account without evicting
  // each other.
  const session = await createSession(user._id);
  setSessionCookies(res, session);

  return res.status(200).json({ user, mustChangePassword: false });
};

// On-demand reset of the demo world. Token-gated: requires
// DEMO_RESET_TOKEN to be set AND matched (header x-demo-reset-token,
// or ?token= / body token), so a public visitor can't wipe the demo.
// The database-name guard in resetAndSeedDemo is the second safety net.
export const demoReset = async (req, res) => {
  const expected = process.env.DEMO_RESET_TOKEN;
  const provided =
    req.get('x-demo-reset-token') || req.query.token || req.body?.token;

  if (!expected || provided !== expected) {
    throw createHttpError(403, 'Invalid or missing reset token');
  }

  const summary = await resetAndSeedDemo();
  return res.status(200).json({ ok: true, summary });
};
