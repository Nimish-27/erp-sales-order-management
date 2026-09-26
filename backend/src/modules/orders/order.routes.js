import { Router } from 'express';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { validate } from './order.validator.js';
import {
  orderIdParam,
  quotationIdParam,
  statusTransitionSchema,
} from './order.validator.js';
import * as ctrl from './order.controller.js';

const router = Router();

const readRoles = ['ADMIN', 'SALES', 'WAREHOUSE', 'VIEWER'];
const writeRoles = ['ADMIN', 'SALES'];

// Conversion endpoint — the headline feature of this phase
router.post(
  '/quotations/:id/convert',
  authorize(...writeRoles),
  validate(quotationIdParam),
  asyncHandler(ctrl.convertQuotationToOrder)
);

// List & Get
router.get('/', authorize(...readRoles), asyncHandler(ctrl.listOrders));
router.get('/:id', authorize(...readRoles), validate(orderIdParam), asyncHandler(ctrl.getOrder));

// Status transition
router.patch(
  '/:id/status',
  authorize(...writeRoles),
  validate({ ...statusTransitionSchema.shape, ...orderIdParam.shape }),
  asyncHandler(ctrl.transitionOrderStatus)
);

export default router;