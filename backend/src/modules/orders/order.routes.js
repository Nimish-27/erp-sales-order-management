import { Router } from 'express';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { validate, orderIdParam, quotationIdParam } from './order.validator.js';
import { validateQuery, orderQuerySchema } from '../../shared/queryValidators.js';
import * as ctrl from './order.controller.js';

const router = Router();

const readRoles = ['ADMIN', 'SALES', 'WAREHOUSE', 'VIEWER'];

router.post(
  '/quotations/:id/convert',
  authorize('ADMIN', 'SALES'),
  validate(quotationIdParam),
  asyncHandler(ctrl.convertQuotationToOrder)
);

router.get('/', authorize(...readRoles), validateQuery(orderQuerySchema), asyncHandler(ctrl.listOrders));
router.get('/:id', authorize(...readRoles), validate(orderIdParam), asyncHandler(ctrl.getOrder));

// Only ADMIN can confirm — triggers inventory reservation transaction
router.post(
  '/:id/confirm',
  authorize('ADMIN'),
  validate(orderIdParam),
  asyncHandler(ctrl.confirmOrder)
);

// Only ADMIN can cancel — releases reserved inventory
router.post(
  '/:id/cancel',
  authorize('ADMIN'),
  validate(orderIdParam),
  asyncHandler(ctrl.cancelOrder)
);

export default router;