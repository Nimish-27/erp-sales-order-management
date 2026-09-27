import { Router } from 'express';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { z } from 'zod';
import * as ctrl from './reservation.controller.js';

const router = Router();

const productIdParam = z.object({ productId: z.string().uuid() });
const orderIdParam = z.object({ id: z.string().uuid() });

// Inventory views — all roles
router.get('/',           authorize('ADMIN', 'SALES', 'WAREHOUSE', 'VIEWER'), asyncHandler(ctrl.listInventory));
router.patch('/:productId/damaged', authorize('ADMIN'),
  (req, _res, next) => {
    const idResult = productIdParam.safeParse(req.params);
    const bodyResult = z.object({ damagedQty: z.number().int().min(0).max(2147483647) }).safeParse(req.body);
    if (!idResult.success || !bodyResult.success) {
      return next({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid damaged inventory update',
        details: { params: idResult.error?.flatten(), body: bodyResult.error?.flatten() },
      });
    }
    req.params = idResult.data;
    req.body = bodyResult.data;
    next();
  },
  asyncHandler(ctrl.updateDamagedQty)
);
router.get('/:productId', authorize('ADMIN', 'SALES', 'WAREHOUSE', 'VIEWER'),
  (req, _res, next) => {
    const r = productIdParam.safeParse(req.params);
    if (!r.success) return next({ status: 400, code: 'VALIDATION_ERROR', message: 'Invalid productId', details: r.error.flatten() });
    req.params = r.data;
    next();
  },
  asyncHandler(ctrl.getInventory)
);

// Confirm order — ADMIN only (the spec mandate)
router.post(
  '/orders/:id/confirm',
  authorize('ADMIN'),
  (req, _res, next) => {
    const r = orderIdParam.safeParse(req.params);
    if (!r.success) return next({ status: 400, code: 'VALIDATION_ERROR', message: 'Invalid order id', details: r.error.flatten() });
    req.params = r.data;
    next();
  },
  asyncHandler(ctrl.confirmOrder)
);

export default router;