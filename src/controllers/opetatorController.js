import { User } from '../models/user.js';

export const getAllOperators = async (req, res, next) => {
  try {
    const operators = await User.find({ role: 'operator' }).select('name');
    res.status(200).json({
      status: 'success',
      results: operators.length,
      data: operators,
    });
  } catch (error) {
    next(error);
  }
};
