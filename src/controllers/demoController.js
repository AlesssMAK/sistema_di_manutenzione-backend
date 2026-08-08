import createHttpError from 'http-errors';
import { User } from '../models/user.js';
import { createSession, setSessionCookies } from '../services/auth.js';
import { DEMO_ROLES } from '../constants/demo.js';

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
