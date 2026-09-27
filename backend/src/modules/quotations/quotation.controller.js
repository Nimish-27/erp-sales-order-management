import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { quotationService } from './quotation.service.js';
import { audit } from '../../shared/audit.js';
import { parsePagination, paginatedResponse } from '../../shared/pagination.js';

export const listQuotations = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filters = {
    customerId: req.query.customerId,
    enquiryId: req.query.enquiryId,
    status: req.query.status,
  };
  const { data, total } = await quotationService.list(filters, { skip, limit });
  res.json({ success: true, ...paginatedResponse(data, total, page, limit) });
});

export const getQuotation = asyncHandler(async (req, res) => {
  const quotation = await quotationService.getById(req.params.id);
  res.json({ success: true, data: quotation });
});

export const createQuotation = asyncHandler(async (req, res) => {
  const quotation = await quotationService.create(req.body, req.user.id);
  audit(req, 'QUOTATION_CREATED', 'Quotation', quotation.id, { newValue: { quotationNumber: quotation.quotationNumber } });
  res.status(201).json({ success: true, data: quotation });
});

export const updateQuotation = asyncHandler(async (req, res) => {
  const quotation = await quotationService.update(req.params.id, req.body, req.user.id);
  audit(req, 'QUOTATION_UPDATED', 'Quotation', quotation.id);
  res.json({ success: true, data: quotation });
});

export const transitionQuotationStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const quotation = await quotationService.transitionStatus(req.params.id, status, req.user.id);
  audit(req, `QUOTATION_${status}`, 'Quotation', quotation.id, { newValue: { status } });
  res.json({ success: true, data: quotation });
});

export const deleteQuotation = asyncHandler(async (req, res) => {
  await quotationService.delete(req.params.id);
  audit(req, 'QUOTATION_DELETED', 'Quotation', req.params.id);
  res.status(204).send();
});