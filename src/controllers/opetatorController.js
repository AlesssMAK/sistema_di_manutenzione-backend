import { User } from '../models/user.js';

export const getAllOperators = async (req, res) => {
  const operators = await User.find({ role: 'operator' }).select('fullName');
  res.status(200).json({
    status: 'success',
    results: operators.length,
    data: operators,
  });
};
