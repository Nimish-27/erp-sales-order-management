import { Router } from 'express';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as ctrl from './product.controller.js';

const router = Router();

// READ — SALES + WAREHOUSE + ADMIN + VIEWER
router.get('/',         authorize('ADMIN','SALES','WAREHOUSE','VIEWER'), asyncHandler(ctrl.list));
router.get('/:id',      authorize('ADMIN','SALES','WAREHOUSE','VIEWER'), asyncHandler(ctrl.getById));

// WRITE — ADMIN only
router.post('/',        authorize('ADMIN'),                            asyncHandler(ctrl.create));
router.patch('/:id',    authorize('ADMIN'),                            asyncHandler(ctrl.update));
router.delete('/:id',   authorize('ADMIN'),                            asyncHandler(ctrl.deleteProduct));

export default router;