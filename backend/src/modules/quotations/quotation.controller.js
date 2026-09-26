import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { quotationService } from './quotation.service.js';

export const listQuotations = asyncHandler(async (req, res) => {
  const filters = {
    customerId: req.query.customerId,
    enquiryId: req.query.enquiryId,
    status: req.query.status,
  };
  const quotations = await quotationService.list(filters);
  res.json({ success: true, data: quotations });
});

export const getQuotation = asyncHandler(async (req, res) => {
  const quotation = await quotationService.getById(req.params.id);
  res.json({ success: true, data: quotation });
});

export const createQuotation = asyncHandler(async (req, res) => {
  const quotation = await quotationService.create(req.body, req.user.id);
  res.status(201).json({ success: true, data: quotation });
});

export const updateQuotation = asyncHandler(async (req, res) => {
  const { id, ...data } = req.body;
  const quotation = await quotationService.update(id, data, req.user.id);
  res.json({ success: true, data: quotation });
});

export const transitionQuotationStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const quotation = await quotationService.transitionStatus(req.params.id, status, req.user.id);
  res.json({ success: true, data: quotation });
});

export const deleteQuotation = asyncHandler(async (req, res) => {
  await quotationService.delete(req.params.id);
  res.status(204).send();
});