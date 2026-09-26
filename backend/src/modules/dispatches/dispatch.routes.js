import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { httpError } from '../../shared/errors.js';

const router = Router();

router.post(
	'/sales-orders/:id/dispatch',
	authorize('ADMIN', 'SALES', 'WAREHOUSE'),
	asyncHandler(async (req, res) => {
		const parsed = z.object({ id: z.string().uuid() }).safeParse(req.params);
		if (!parsed.success) {
			throw httpError(400, 'Invalid order id', 'VALIDATION_ERROR');
		}

		const { vehicleNumber, driverName } = req.body;
		const dispatch = await prisma.$transaction(async (tx) => {
			const order = await tx.salesOrder.findUnique({
				where: { id: parsed.data.id },
				include: { items: true },
			});
			if (!order) throw httpError(404, 'Sales order not found', 'ORDER_NOT_FOUND');
			if (order.status !== 'CONFIRMED') {
				throw httpError(409, 'Only confirmed orders can be dispatched', 'ORDER_NOT_DISPATCHABLE');
			}

			const existing = await tx.dispatch.findFirst({ where: { salesOrderId: order.id } });
			if (existing) throw httpError(409, 'Sales order is already dispatched', 'DISPATCH_ALREADY_EXISTS');

			for (const item of order.items) {
				await tx.inventory.update({
					where: { productId: item.productId },
					data: {
						physicalQty: { decrement: item.quantity },
						reservedQty: { decrement: item.quantity },
					},
				});
			}

			const prefix = `DSP-${new Date().getFullYear()}-`;
			const last = await tx.dispatch.findFirst({
				where: { dispatchNumber: { startsWith: prefix } },
				orderBy: { dispatchNumber: 'desc' },
				select: { dispatchNumber: true },
			});
			const nextNumber = last ? Number(last.dispatchNumber.split('-').pop()) + 1 : 1;
			const dispatchNumber = `${prefix}${String(nextNumber).padStart(4, '0')}`;

			const created = await tx.dispatch.create({
				data: {
					dispatchNumber,
					salesOrderId: order.id,
					vehicleNumber: vehicleNumber || null,
					driverName: driverName || null,
					items: { create: order.items.map(({ productId, quantity }) => ({ productId, quantity })) },
				},
				include: { items: true, salesOrder: true },
			});

			await tx.salesOrder.update({
				where: { id: order.id },
				data: { status: 'DISPATCHED' },
			});

			return created;
		});

		res.status(201).json({ success: true, data: dispatch });
	})
);

export default router;
