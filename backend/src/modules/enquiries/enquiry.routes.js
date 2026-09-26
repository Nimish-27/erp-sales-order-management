import { Router } from 'express';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { validate } from './enquiry.validator.js';
import {
  createEnquirySchema,
  updateEnquirySchema,
  enquiryIdParam,
} from './enquiry.validator.js';
import * as ctrl from './enquiry.controller.js';

const router = Router();

// All routes require authentication
// READ: ADMIN, SALES, WAREHOUSE, VIEWER
const readRoles = ['ADMIN', 'SALES', 'WAREHOUSE', 'VIEWER'];
const writeRoles = ['ADMIN', 'SALES'];

router.get('/', authorize(...readRoles), asyncHandler(ctrl.listEnquiries));
router.get('/:id', authorize(...readRoles), validate(enquiryIdParam), asyncHandler(ctrl.getEnquiry));
router.post('/', authorize(...writeRoles), validate(createEnquirySchema), asyncHandler(ctrl.createEnquiry));
router.patch('/:id', authorize(...writeRoles), validate({ ...updateEnquirySchema.shape, ...enquiryIdParam.shape }), asyncHandler(ctrl.updateEnquiry));
router.delete('/:id', authorize('ADMIN'), validate(enquiryIdParam), asyncHandler(ctrl.deleteEnquiry));

export default router;