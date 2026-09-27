import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { orderService } from './orders.service.js';
import { confirmSalesOrder, cancelSalesOrder } from '../reservations/reservation.service.js';
import { audit } from '../../shared/audit.js';
import { parsePagination, paginatedResponse } from '../../shared/pagination.js';

export const convertQuotationToOrder = asyncHandler(async (req, res) => {
  const order = await orderService.convertFromQuotation(req.params.id, req.user.id);
  audit(req, 'ORDER_CREATED', 'SalesOrder', order.id, { newValue: { orderNumber: order.orderNumber, quotationId: req.params.id } });
  res.status(201).json({ success: true, data: order });
});

export const listOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filters = {
    customerId: req.query.customerId,
    status: req.query.status,
    fromDate: req.query.fromDate,
    toDate: req.query.toDate,
  };
  const { data, total } = await orderService.list(filters, { skip, limit });
  res.json({ success: true, ...paginatedResponse(data, total, page, limit) });
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getById(req.params.id);
  res.json({ success: true, data: order });
});

export const confirmOrder = asyncHandler(async (req, res) => {
  const order = await confirmSalesOrder(req.params.id, req.user.id);
  audit(req, 'ORDER_CONFIRMED', 'SalesOrder', order.id, { newValue: { status: 'CONFIRMED' } });
  res.json({ success: true, data: order });
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await cancelSalesOrder(req.params.id);
  audit(req, 'ORDER_CANCELLED', 'SalesOrder', order.id, { newValue: { status: 'CANCELLED' } });
  res.json({ success: true, data: order });
});