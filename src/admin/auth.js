import { User } from '../models/user.js';
import bcrypt from 'bcrypt';

export const authenticate = async (email, password) => {
  try {
    // AdminJS calls this with the credentials from its own login
    // form. The User model identifies people by email (not phone),
    // so we look up by email here — without this fix AdminJS could
    // never authenticate anyone.
    const user = await User.findOne({ email });

    if (!user) return null;
    if (user.role !== 'admin') return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    return {
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      _id: user._id,
    };
  } catch (error) {
    console.error('[admin-auth] authentication error', error.message);
    return null;
  }
};
