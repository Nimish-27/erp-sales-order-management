import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { orderService } from './order.service.js';

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

export const transitionOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await orderService.transitionStatus(req.params.id, status, req.user.role);
  res.json({ success: true, data: order });
});

export const orderController = {
  convertQuotationToOrder,
  listOrders,
  getOrder,
  transitionOrderStatus,
};