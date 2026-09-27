import { Router } from 'express';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { validate, dispatchOrderSchema, dispatchIdParam, dispatchStatusSchema } from './dispatch.validator.js';
import * as ctrl from './dispatch.controller.js';

const router = Router();

router.post(
  '/sales-orders/:id/dispatch',
  authorize('ADMIN'),
  validate(dispatchOrderSchema),
  ctrl.createDispatch
);

router.patch(
  '/:id/status',
  authorize('ADMIN'),
  validate(dispatchStatusSchema),
  ctrl.updateDispatchStatus
);

export default router;
