import createHttpError from 'http-errors';
import { User } from '../models/user.js';
import bcrypt from 'bcrypt';

export const updateProfile = async (req, res) => {
  const targetUser = await User.findById(req.params.userId);

  if (!targetUser) {
    throw createHttpError(404, 'User not found');
  }

  if (
    req.user._id.toString() === req.params.userId &&
    req.body.role &&
    req.body.role !== 'admin'
  ) {
    throw createHttpError(403, 'Admin cannot remove own admin role');
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
    const value = req.body[key];

    if (value === undefined || value === null || value === '') continue;

    if (key === 'password') {
      updates[key] = await bcrypt.hash(value, 10);
    } else {
      updates[key] = value;
    }
  }

  const finalRole = updates.role ?? targetUser.role;
  const roleChanged = updates.role && updates.role !== targetUser.role;

  if (roleChanged) {
    if (finalRole === 'operator' && !updates.personalCode) {
      throw createHttpError(
        400,
        'Personal code is required when assigning operator role',
      );
    }

    if (
      targetUser.role === 'operator' &&
      finalRole !== 'operator' &&
      !updates.password
    ) {
      throw createHttpError(
        400,
        'Password is required when changing role from operator',
      );
    }
  }

  if (finalRole !== 'operator') {
    delete updates.personalCode;
    if (targetUser.role === 'operator' && roleChanged) {
      updates.personalCode = null;
    }
  }

  if (finalRole === 'operator') {
    delete updates.password;
    if (targetUser.role !== 'operator' && roleChanged) {
      updates.password = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    throw createHttpError(
      400,
      'Request body does not contain any fields to update',
    );
  }

  let updatedUser;
  try {
    Object.assign(targetUser, updates);
    updatedUser = await targetUser.save();
  } catch (err) {
    if (err.code === 11000) {
      throw createHttpError(409, 'Email already in use');
    }
    throw err;
  }

  const { password: _password, ...userWithoutPassword } =
    updatedUser.toObject();

  res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: userWithoutPassword,
  });
};

export const getAllUsers = async (req, res) => {
  const { search, role, status, page = 1, perPage = 10 } = req.query;

  const skip = (page - 1) * perPage;
  const usersQuery = User.find();

  if (role) {
    usersQuery.where('role').equals(role);
  }

  if (status) {
    usersQuery.where('status').equals(status);
  }

  if (search) {
    usersQuery.where({
      $or: [{ fullName: { $regex: search, $options: 'i' } }],
    });
  }

  const [totalUsers, users] = await Promise.all([
    usersQuery.clone().countDocuments(),
    usersQuery.skip(skip).limit(perPage),
  ]);

  const totalPages = Math.ceil(totalUsers / perPage);

  res.status(200).json({
    status: 'success',
    users: { page, perPage, totalUsers, totalPages, users },
  });
};

export const getUser = async (req, res) => {
  const user = req.user;

  if (!user) {
    throw createHttpError(401, 'Not authenticated');
  }

  res.status(200).json({
    success: true,
    user: user,
  });
};
