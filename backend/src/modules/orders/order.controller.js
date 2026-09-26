import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { orderService } from './orders.service.js';
import { confirmSalesOrder } from '../reservations/reservation.service.js';

export const convertQuotationToOrder = asyncHandler(async (req, res) => {
  const order = await orderService.convertFromQuotation(req.params.id, req.user.id);
  res.status(201).json({ success: true, data: order });
});

export const listOrders = asyncHandler(async (req, res) => {
  const filters = {
    customerId: req.query.customerId,
    status: req.query.status,
    fromDate: req.query.fromDate,
    toDate: req.query.toDate,
  };
  const orders = await orderService.list(filters);
  res.json({ success: true, data: orders });
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getById(req.params.id);
  res.json({ success: true, data: order });
});

export const confirmOrder = asyncHandler(async (req, res) => {
  const order = await confirmSalesOrder(req.params.id, req.user.id);
  res.json({ success: true, data: order });
});