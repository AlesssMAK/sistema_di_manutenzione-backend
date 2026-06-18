import { User } from '../models/user.js';
import bcrypt from 'bcrypt';

export const authenticate = async (phone, password) => {
  try {
    const user = await User.findOne({ phone });

    if (!user) return null;
    if (user.role !== 'admin') return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    return {
      phone: user.phone,
      name: user.name,
      email: user.email,
      role: user.role,
      _id: user._id,
    };
  } catch (error) {
    console.error('[admin-auth] authentication error', error.message);
    return null;
  }
};
