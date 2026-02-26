import { Router } from 'express';
const router = Router();
router.post('manager/faultAddM', celebrate(addedByManagerSchema), addFault);
export default router;
