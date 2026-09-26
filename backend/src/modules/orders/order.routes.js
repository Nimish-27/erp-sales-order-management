import { Router } from 'express';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { validate, orderIdParam, quotationIdParam } from './order.validator.js';
import * as ctrl from './order.controller.js';

const router = Router();

const readRoles = ['ADMIN', 'SALES', 'WAREHOUSE', 'VIEWER'];

router.post(
  '/quotations/:id/convert',
  authorize('ADMIN', 'SALES'),
  validate(quotationIdParam),
  asyncHandler(ctrl.convertQuotationToOrder)
);

router.get('/', authorize(...readRoles), asyncHandler(ctrl.listOrders));
router.get('/:id', authorize(...readRoles), validate(orderIdParam), asyncHandler(ctrl.getOrder));

// Only ADMIN can confirm — triggers inventory reservation transaction
router.post(
  '/:id/confirm',
  authorize('ADMIN'),
  validate(orderIdParam),
  asyncHandler(ctrl.confirmOrder)
);

export default router;