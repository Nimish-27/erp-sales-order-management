import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { Prisma } from '@prisma/client';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { httpError } from '../../shared/errors.js';

const router = Router();

router.post(
	'/sales-orders/:id/dispatch',
	authorize('ADMIN'),
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

			// Lock inventory rows in deterministic order, then verify reservedQty >= requested
			const sortedItems = [...order.items].sort((a, b) => a.productId.localeCompare(b.productId));
			const failures = [];
			for (const item of sortedItems) {
				const rows = await tx.$queryRaw(
					Prisma.sql`SELECT "physical_qty" AS "physicalQty", "reserved_qty" AS "reservedQty"
					           FROM "inventory" WHERE "product_id" = ${item.productId} FOR UPDATE`
				);
				if (rows.length === 0) throw httpError(404, `Inventory not found for product ${item.productId}`, 'INVENTORY_NOT_FOUND');
				const inv = rows[0];
				if (Number(inv.reservedQty) < item.quantity) {
					const product = await tx.product.findUnique({ where: { id: item.productId }, select: { productCode: true } });
					failures.push({ productCode: product?.productCode || item.productId, requested: item.quantity, reserved: Number(inv.reservedQty) });
				}
			}
			if (failures.length > 0) throw httpError(409, 'Dispatch quantity exceeds reserved stock', 'INSUFFICIENT_RESERVED', { failures });

			for (const item of sortedItems) {
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
