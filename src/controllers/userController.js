import createHttpError from 'http-errors';
import { User } from '../models/user.js';
import bcrypt from 'bcrypt';

export const updateProfile = async (req, res) => {
  const targetUser = await User.findById(req.params.userId);

  if (!targetUser) {
    throw createHttpError(404, 'User not found');
  }

  const allowedUpdates = [
    'role',
    'fullName',
    'email',
    'password',
    'personalCode',
    'avatar',
    'status',
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

  if (
    req.user._id.toString() === req.params.userId &&
    updates.role &&
    updates.role !== 'admin'
  ) {
    throw createHttpError(400, 'Admin cannot remove own admin role');
  }

  if (targetUser.role !== 'operator') {
    delete updates.personalCode;
  }

  const updatedUser = await User.findByIdAndUpdate(req.params.userId, updates, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: 'User updated by admin successfully',
    data: updatedUser,
  });
};

export const getAllUsers = async (req, res) => {
  const userList = await User.find();
  res.status(200).json({
    status: 'success',
    data: userList,
  });
};

export const getUser = async (req, res) => {
  const user = req.user;

  if (!user) {
    throw createHttpError(401, 'Not authenticated');
  }

  res.status(200).json({
    success: true,
    data: user,
  });
};
