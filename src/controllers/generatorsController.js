import createHttpError from 'http-errors';
import generatePersonalCode from '../utils/generators/generatePersonalCode.js';
import generateFaultId from '../utils/generators/generateFaultId.js';
import { generatePassword } from '../utils/generators/generatePassword.js';

export const getNewFaultId = async (req, res) => {
  const id = await generateFaultId();

  if (!id) {
    throw createHttpError(404, 'Failed to generate fault ID');
  }

  res.status(200).json(id);
};

export const getNewPersonalCode = async (req, res) => {
  const personalCode = await generatePersonalCode();

  if (!personalCode) {
    throw createHttpError(404, 'Failed to generate personal code');
  }

  res.status(200).json(personalCode);
};

export const getNewPassword = async (req, res) => {
  const password = generatePassword();

  if (!password) {
    throw createHttpError(404, 'Failed to generate password');
  }

  res.status(200).json(password);
};
