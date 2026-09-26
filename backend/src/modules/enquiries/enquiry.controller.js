import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { enquiryService } from './enquiry.service.js';

export const listEnquiries = asyncHandler(async (req, res) => {
  const filters = {
    customerId: req.query.customerId,
    status: req.query.status,
    fromDate: req.query.fromDate,
    toDate: req.query.toDate,
  };
  const enquiries = await enquiryService.list(filters);
  res.json({ success: true, data: enquiries });
});

export const getEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await enquiryService.getById(req.params.id);
  res.json({ success: true, data: enquiry });
});

export const createEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await enquiryService.create(req.body, req.user.id);
  res.status(201).json({ success: true, data: enquiry });
});

export const updateEnquiry = asyncHandler(async (req, res) => {
  const { id, ...data } = req.body;
  const enquiry = await enquiryService.update(id, data);
  res.json({ success: true, data: enquiry });
});

export const deleteEnquiry = asyncHandler(async (req, res) => {
  await enquiryService.delete(req.params.id);
  res.status(204).send();
});