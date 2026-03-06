import { Joi, Segments } from 'celebrate';
import { USER_STATUS } from '../constants/status.js';

export const registerUserSchema = {
  [Segments.BODY]: Joi.object({
    role: Joi.string()
      .valid('operator', 'admin', 'manager', 'maintenanceWorker', 'safety')
      .required(),

    fullName: Joi.string()
      .trim()
      .pattern(
        /^[A-Za-zÀ-ÖØ-öø-ÿА-Яа-яІіЇїЄєҐґ'-]{2,}( [A-Za-zÀ-ÖØ-öø-ÿА-Яа-яІіЇїЄєҐґ'-]{2,})+$/,
      )
      .required()
      .messages({
        'string.pattern.base':
          'Full name must contain at least two words and only letters',
      }),

    email: Joi.string().email().required(),

    // password тільки для НЕ операторів
    password: Joi.when('role', {
      is: 'operator',
      then: Joi.forbidden(),
      otherwise: Joi.string().min(8).required(),
    }),

    avatar: Joi.string().allow('').default(''),

    // personalCode тільки для операторів
    personalCode: Joi.when('role', {
      is: 'operator',
      then: Joi.string()
        .uppercase()
        .regex(/^[A-Z]{2}\d{5}$/)
        .required(),
      otherwise: Joi.forbidden(),
    }),

    status: Joi.string()
      .valid(...Object.values(USER_STATUS))
      .default(USER_STATUS.ACTIVE),
  }),
};

export const loginUserSchema = {
  [Segments.BODY]: Joi.alternatives().try(
    // Логін для операторів (без пароля)
    Joi.object({
      fullName: Joi.string()
        .trim()
        .pattern(
          /^[A-Za-zÀ-ÖØ-öø-ÿА-Яа-яІіЇїЄєҐґ'-]{2,}( [A-Za-zÀ-ÖØ-öø-ÿА-Яа-яІіЇїЄєҐґ'-]{2,})+$/,
        )
        .required()
        .messages({
          'string.pattern.base':
            'Full name must contain at least two words and only letters',
        }),

      personalCode: Joi.string()
        .uppercase()
        .regex(/^[A-Z]{2}\d{5}$/)
        .required(),
    }),

    // Логін для інших ролей (email + password)
    Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    }),
  ),
};
