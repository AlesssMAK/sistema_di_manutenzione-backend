import { Router } from 'express';
import { celebrate } from 'celebrate';
import { authenticate } from '../middleware/authenticate.js';
import { ctrlWrapper } from '../utils/ctrlWrapper.js';
import {
  subscribePushSchema,
  unsubscribePushSchema,
} from '../validations/pushValidation.js';
import {
  subscribePush,
  unsubscribePush,
  getPushPublicKey,
} from '../controllers/pushController.js';

const router = Router();

router.get('/push/public-key', authenticate, ctrlWrapper(getPushPublicKey));

router.post(
  '/push/subscribe',
  authenticate,
  celebrate(subscribePushSchema),
  ctrlWrapper(subscribePush),
);

router.post(
  '/push/unsubscribe',
  authenticate,
  celebrate(unsubscribePushSchema),
  ctrlWrapper(unsubscribePush),
);

export default router;
