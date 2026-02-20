import { Joi, Segments } from 'celebrate';
import { USER_STATUS } from '../constants/status.js';

export const registerUserSchema = {
  [Segments.BODY]: Joi.object({
    name: Joi.string().max(32).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    phone: Joi.string()
      .pattern(/^\+39\d{10}$/)
      .message('Phone must be in format +39XXXXXXXXXX')
      .required(),
    lastname: Joi.string().max(32).required(),
    city: Joi.string().max(32).allow('').default(''),
    avatar: Joi.string().min(8).allow('').default(''),
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
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
};
