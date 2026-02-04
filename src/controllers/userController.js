import createHttpError from 'http-errors';
import { User } from '../models/user.js';
import bcrypt from 'bcrypt';

export const updateProfile = async (req, res) => {
  const allowedUpdates = [
    'name',
    'email',
    'password',
    'phone',
    'lastname',
    'city',
    'avatar',
    'role',
  ];
  const updates = {};

  for (const key of allowedUpdates) {
    if (req.body[key] !== undefined) {
      if (key === 'password') {
        updates[key] = await bcrypt.hash(req.body[key], 10);
      } else {
        updates[key] = req.body[key];
      }
    }
  }
  if (Object.keys(updates).length === 0) {
    throw createHttpError(
      400,
      'Request body does not contain any fields to update',
    );
  }
  const updatedUser = await User.findByIdAndUpdate(req.params.userId, updates, {
    new: true,
    runValidators: true,
  });
  if (!updatedUser) {
    throw createHttpError(404, 'User not found');
  }
  res.status(200).json({
    success: true,
    message: 'User updated by admin successfully',
    data: updatedUser,
  });
};
