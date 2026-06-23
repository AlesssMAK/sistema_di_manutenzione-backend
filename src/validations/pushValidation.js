import { Joi, Segments } from 'celebrate';

export const subscribePushSchema = {
  [Segments.BODY]: Joi.object({
    endpoint: Joi.string().uri().required(),
    keys: Joi.object({
      p256dh: Joi.string().required(),
      auth: Joi.string().required(),
    }).required(),
    // PushSubscription JSON also carries expirationTime (usually null)
    // — accept and ignore it rather than 400 on the extra key.
    expirationTime: Joi.any().optional(),
  }),
};

export const unsubscribePushSchema = {
  [Segments.BODY]: Joi.object({
    endpoint: Joi.string().uri().required(),
  }),
};
