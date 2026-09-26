import { Router } from 'express';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { validate } from './quotation.validator.js';
import {
  createQuotationSchema,
  updateQuotationSchema,
  quotationIdParam,
  statusTransitionSchema,
} from './quotation.validator.js';
import * as ctrl from './quotation.controller.js';

const router = Router();

const readRoles = ['ADMIN', 'SALES', 'WAREHOUSE', 'VIEWER'];
const writeRoles = ['ADMIN', 'SALES'];

// List & Get
router.get('/', authorize(...readRoles), asyncHandler(ctrl.listQuotations));
router.get('/:id', authorize(...readRoles), validate(quotationIdParam), asyncHandler(ctrl.getQuotation));

// Create (from enquiry)
router.post('/', authorize(...writeRoles), validate(createQuotationSchema), asyncHandler(ctrl.createQuotation));

// Update (only DRAFT)
router.patch('/:id', authorize(...writeRoles), validate({ ...updateQuotationSchema.shape, ...quotationIdParam.shape }), asyncHandler(ctrl.updateQuotation));

// Status Transition — THE KEY ENDPOINT
router.patch(
  '/:id/status',
  authorize(...writeRoles),
  validate({ ...statusTransitionSchema.shape, ...quotationIdParam.shape }),
  asyncHandler(ctrl.transitionQuotationStatus)
);

// Delete
router.delete('/:id', authorize('ADMIN'), validate(quotationIdParam), asyncHandler(ctrl.deleteQuotation));

export default router;