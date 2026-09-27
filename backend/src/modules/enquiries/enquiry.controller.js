import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { enquiryService } from './enquiry.service.js';
import { audit } from '../../shared/audit.js';
import { parsePagination, paginatedResponse } from '../../shared/pagination.js';

export const listEnquiries = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filters = {
    customerId: req.query.customerId,
    status:     req.query.status,
    fromDate:   req.query.fromDate,  // already a Date from validateQuery
    toDate:     req.query.toDate,
  };
  const { data, total } = await enquiryService.list(filters, { skip, limit });
  res.json({ success: true, ...paginatedResponse(data, total, page, limit) });
});

export const getEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await enquiryService.getById(req.params.id);
  res.json({ success: true, data: enquiry });
});

export const createEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await enquiryService.create(req.body, req.user.id);
  audit(req, 'ENQUIRY_CREATED', 'Enquiry', enquiry.id, { newValue: { enquiryNumber: enquiry.enquiryNumber } });
  res.status(201).json({ success: true, data: enquiry });
});

export const updateEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await enquiryService.update(req.params.id, req.body);
  audit(req, 'ENQUIRY_UPDATED', 'Enquiry', enquiry.id);
  res.json({ success: true, data: enquiry });
});

export const transitionEnquiryStatus = asyncHandler(async (req, res) => {
  const enquiry = await enquiryService.transitionStatus(req.params.id, req.body.status);
  audit(req, `ENQUIRY_${req.body.status}`, 'Enquiry', enquiry.id, { newValue: { status: req.body.status } });
  res.json({ success: true, data: enquiry });
});

export const deleteEnquiry = asyncHandler(async (req, res) => {
  await enquiryService.delete(req.params.id);
  audit(req, 'ENQUIRY_DELETED', 'Enquiry', req.params.id);
  res.status(204).send();
});
