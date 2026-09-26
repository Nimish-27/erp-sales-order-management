import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as reservationService from './reservation.service.js';
import { orderService } from '../orders/order.service.js';

export const confirmOrder = asyncHandler(async (req, res) => {
  const order = await reservationService.confirmSalesOrder(req.params.id, req.user.id);
  res.status(200).json({ success: true, data: order });
});

export const listInventory = asyncHandler(async (_req, res) => {
  const inventory = await reservationService.listInventory();
  res.json({ success: true, data: inventory });
});

export const getInventory = asyncHandler(async (req, res) => {
  const inv = await reservationService.getInventory(req.params.productId);
  res.json({ success: true, data: inv });
});