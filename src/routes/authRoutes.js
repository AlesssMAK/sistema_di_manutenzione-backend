import { Router } from 'express';
import { celebrate } from 'celebrate';

const router = Router();

///без админа - нужно добавить админа
router.post(
  '/auth/register',
  authLimiter,
  celebrate(registerUserSchema),
  ctrlWrapper(registerUser),
);
