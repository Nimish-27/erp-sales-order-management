import { Router } from 'express';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { validate } from './enquiry.validator.js';
import {
  createEnquirySchema,
  updateEnquirySchema,
  enquiryStatusTransitionSchema,
  enquiryIdParam,
} from './enquiry.validator.js';
import * as ctrl from './enquiry.controller.js';
import { validateQuery, enquiryQuerySchema } from '../../shared/queryValidators.js';

const router = Router();

const readRoles = ['ADMIN', 'SALES', 'WAREHOUSE', 'VIEWER'];
const writeRoles = ['ADMIN', 'SALES'];

router.get('/', authorize(...readRoles), validateQuery(enquiryQuerySchema), asyncHandler(ctrl.listEnquiries));
router.get('/:id', authorize(...readRoles), validate(enquiryIdParam), asyncHandler(ctrl.getEnquiry));
router.post('/', authorize(...writeRoles), validate(createEnquirySchema), asyncHandler(ctrl.createEnquiry));
router.patch('/:id', authorize(...writeRoles), validate({ ...updateEnquirySchema.shape, ...enquiryIdParam.shape }), asyncHandler(ctrl.updateEnquiry));
router.patch('/:id/status', authorize(...writeRoles), validate({ ...enquiryStatusTransitionSchema.shape, ...enquiryIdParam.shape }), asyncHandler(ctrl.transitionEnquiryStatus));
router.delete('/:id', authorize('ADMIN'), validate(enquiryIdParam), asyncHandler(ctrl.deleteEnquiry));

export default router;