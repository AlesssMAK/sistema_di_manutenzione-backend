/**
 * Create the first admin user on a fresh database.
 *
 * Reads BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD and
 * BOOTSTRAP_ADMIN_NAME from the environment (or .env). Idempotent:
 * if an admin with the given email already exists the script
 * exits cleanly with a notice — safe to wire into deploy pipelines.
 *
 * Usage:
 *   BOOTSTRAP_ADMIN_EMAIL=admin@example.com \
 *   BOOTSTRAP_ADMIN_PASSWORD='change-me' \
 *   BOOTSTRAP_ADMIN_NAME='First Admin' \
 *   npm run bootstrap-admin
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from '../src/models/user.js';

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return value;
};

const main = async () => {
  const email = required('BOOTSTRAP_ADMIN_EMAIL').toLowerCase().trim();
  const password = required('BOOTSTRAP_ADMIN_PASSWORD');
  const fullName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Admin';

  if (password.length < 8) {
    console.error('BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters');
    process.exit(1);
  }

  const mongoUrl = required('MONGO_URL');

  await mongoose.connect(mongoUrl);

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role === 'admin') {
        console.log(`ℹ️  Admin ${email} already exists, nothing to do.`);
      } else {
        console.error(
          `User ${email} exists but has role '${existing.role}', not 'admin'.`,
        );
        process.exitCode = 1;
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await User.create({
      role: 'admin',
      fullName,
      email,
      password: passwordHash,
      isFirstLogin: false,
    });

    console.log(`✅ Admin created: ${admin.email} (id=${admin._id})`);
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error('bootstrap-admin failed:', err);
  process.exit(1);
});
