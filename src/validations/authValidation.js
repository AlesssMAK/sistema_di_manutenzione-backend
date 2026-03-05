import { Joi, Segments } from 'celebrate';
import { USER_STATUS } from '../constants/status.js';

export const registerUserSchema = {
  [Segments.BODY]: Joi.object({
    name: Joi.string().max(32).required(),
    lastname: Joi.string().max(32).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    city: Joi.string().max(32).allow('').default(''),
    avatar: Joi.string().min(8).allow('').default(''),
    personalCode: Joi.string()
      .uppercase()
      .regex(/^[A-Z]{2}\d{3}$/)
      .required(),
    role: Joi.string()
      .valid('operator', 'admin', 'manager', 'maintenanceWorker', 'safety')
      .default('operator')
      .required(),
    status: Joi.string()
      .valid(...Object.values(USER_STATUS)) // беремо всі значення з вашої константи
      .default(USER_STATUS.ACTIVE)
      .required(),
  }),
};

export const loginUserSchema = {
  [Segments.BODY]: Joi.object({
    email: Joi.string().email(),
    personalCode: Joi.string()
      .uppercase()
      .regex(/^[A-Z]{2}\d{3}$/),
    password: Joi.string().required(),
  }).xor('email', 'personalCode'), // Требует строго одно из двух
};
