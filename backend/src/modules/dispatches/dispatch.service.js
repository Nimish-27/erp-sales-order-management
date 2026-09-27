import { prisma } from '../../config/db.js';
import { Prisma } from '@prisma/client';
import { dispatchRepository } from './dispatch.repository.js';
import { httpError } from '../../shared/errors.js';

const DISPATCH_TRANSITIONS = {
  PENDING:    ['IN_TRANSIT'],
  IN_TRANSIT: ['DELIVERED'],
};

export const dispatchService = {
  async createDispatch(salesOrderId, { vehicleNumber, driverName }) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id: salesOrderId },
        include: { items: true },
      });
      if (!order) throw httpError(404, 'Sales order not found', 'ORDER_NOT_FOUND');
      if (order.status !== 'CONFIRMED') {
        throw httpError(409, 'Only confirmed orders can be dispatched', 'ORDER_NOT_DISPATCHABLE');
      }

      const existing = await dispatchRepository.findBySalesOrderId(salesOrderId, tx);
      if (existing) throw httpError(409, 'Sales order is already dispatched', 'DISPATCH_ALREADY_EXISTS');

      // Lock inventory rows in deterministic order, verify reservedQty >= requested
      const sortedItems = [...order.items].sort((a, b) => a.productId.localeCompare(b.productId));
      const failures = [];
      for (const item of sortedItems) {
        const rows = await tx.$queryRaw(
          Prisma.sql`SELECT "physical_qty" AS "physicalQty", "reserved_qty" AS "reservedQty"
                     FROM "inventory" WHERE "product_id" = ${item.productId} FOR UPDATE`
        );
        if (rows.length === 0) throw httpError(404, `Inventory not found for product ${item.productId}`, 'INVENTORY_NOT_FOUND');
        if (Number(rows[0].reservedQty) < item.quantity) {
          const product = await tx.product.findUnique({ where: { id: item.productId }, select: { productCode: true } });
          failures.push({ productCode: product?.productCode || item.productId, requested: item.quantity, reserved: Number(rows[0].reservedQty) });
        }
      }
      if (failures.length > 0) throw httpError(409, 'Dispatch quantity exceeds reserved stock', 'INSUFFICIENT_RESERVED', { failures });

      for (const item of sortedItems) {
        await tx.inventory.update({
          where: { productId: item.productId },
          data: { physicalQty: { decrement: item.quantity }, reservedQty: { decrement: item.quantity } },
        });
      }

      const dispatchNumber = await dispatchRepository.generateDispatchNumber(tx);
      const dispatch = await dispatchRepository.create(tx, {
        salesOrderId,
        dispatchNumber,
        vehicleNumber,
        driverName,
        items: order.items,
      });

      await tx.salesOrder.update({ where: { id: salesOrderId }, data: { status: 'DISPATCHED' } });

      return dispatch;
    });
  },

  async transitionStatus(dispatchId, newStatus) {
    return prisma.$transaction(async (tx) => {
      const dispatch = await tx.dispatch.findUnique({ where: { id: dispatchId } });
      if (!dispatch) throw httpError(404, 'Dispatch not found', 'DISPATCH_NOT_FOUND');

      const allowed = DISPATCH_TRANSITIONS[dispatch.status];
      if (!allowed || !allowed.includes(newStatus)) {
        throw httpError(409, `Invalid transition: ${dispatch.status} → ${newStatus}. Allowed: ${allowed?.join(', ') || 'none'}`, 'INVALID_TRANSITION');
      }

      const updated = await dispatchRepository.updateStatus(tx, dispatchId, newStatus);

      if (newStatus === 'DELIVERED') {
        await tx.salesOrder.update({ where: { id: dispatch.salesOrderId }, data: { status: 'DELIVERED' } });
      }

      return updated;
    });
  },
};
