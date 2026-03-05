import generateFaultId from '../utils/generateFaultId.js';
import createHttpError from 'http-errors';

export const getNewFaultId = async (req, res) => {
  const id = await generateFaultId();

  if (!id) {
    throw createHttpError(404, 'Failed to generate fault ID');
  }

  res.status(200).json(id);
};
