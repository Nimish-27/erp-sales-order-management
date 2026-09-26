import { prisma } from '../../config/db.js';
import { Prisma } from '@prisma/client';
import {
  lockInventoryForOrder,
  bumpReservedQty,
} from './reservation.repository.js';
import { httpError } from '../../shared/errors.js';

/**
 * Confirm a Sales Order — the headline operation.
 *
 * Guarantees:
 * - All-or-nothing: if ANY line fails stock check, NOTHING is reserved
 * - Race-safe: SELECT ... FOR UPDATE serializes concurrent attempts
 * - Audit-friendly: writes Reservation rows with status=CONFIRMED
 *
 * @param {string} orderId
 * @param {string} userId - who confirmed (for audit)
 */
export const confirmSalesOrder = async (orderId, userId) => {
  return prisma.$transaction(async (tx) => {
    // 1. Load the order (inside tx so it sees a consistent snapshot)
    const order = await tx.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        dispatches: { select: { id: true } },
      },
    });

    if (!order) throw httpError(404, 'Sales order not found', 'ORDER_NOT_FOUND');

    // 2. Guard: order must be in CREATED status (not already confirmed/dispatched/cancelled)
    if (order.status !== 'CREATED') {
      throw httpError(
        409,
        `Cannot confirm order in status ${order.status}. Only CREATED orders can be confirmed.`,
        'ORDER_NOT_CONFIRMABLE'
      );
    }

    // 3. Guard: order must have at least one item
    if (order.items.length === 0) {
      throw httpError(409, 'Cannot confirm order with no items', 'EMPTY_ORDER');
    }

    const productIds = order.items.map((i) => i.productId);

    // 4. Lock ALL inventory rows for these products (in deterministic order)
    //    Any concurrent tx trying to lock the same row will WAIT here.
    let inventoryMap;
    try {
      inventoryMap = await lockInventoryForOrder(tx, productIds);
    } catch (err) {
      if (err.code === 'INVENTORY_NOT_FOUND') {
        throw httpError(
          404,
          `No inventory record for products: ${err.missing.join(', ')}`,
          'INVENTORY_NOT_FOUND'
        );
      }
      throw err;
    }

    // 5. Aggregate required qty per product (order might have duplicate products)
    const required = new Map();
    for (const item of order.items) {
      required.set(item.productId, (required.get(item.productId) || 0) + item.quantity);
    }

    // 6. Check stock for each product
    const failures = [];
    for (const [productId, needQty] of required) {
      const inv = inventoryMap.get(productId);
      const available = inv.physicalQty - inv.reservedQty;

      if (available < needQty) {
        // Look up product code for the error message
        const product = await tx.product.findUnique({
          where: { id: productId },
          select: { productCode: true, name: true },
        });
        failures.push({
          productId,
          productCode: product?.productCode || productId,
          productName: product?.name || 'Unknown',
          requested: needQty,
          available,
          shortBy: needQty - available,
        });
      }
    }

    if (failures.length > 0) {
      // ROLLBACK (automatic when we throw from the tx callback)
      throw httpError(409, 'Insufficient stock for one or more products', 'INSUFFICIENT_STOCK', {
        failures,
      });
    }

    // 7. All stock checks passed → increment reserved_qty for each product
    await bumpReservedQty(
      tx,
      Array.from(required.entries()).map(([productId, delta]) => ({ productId, delta }))
    );

    // 8. Create Reservation audit rows (one per order item)
    const reservationRows = order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      status: 'CONFIRMED',
      userId,
      orderId,
    }));

    await tx.reservation.createMany({ data: reservationRows });

    // 9. Update order status to CONFIRMED
    const updatedOrder = await tx.salesOrder.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED' },
      include: {
        items: { include: { product: true } },
        customer: true,
      },
    });

    return updatedOrder;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 15000,
    maxWait: 5000,
  });
};

/**
 * Get current stock levels (read-only, no lock).
 */
export const getInventory = async (productId) => {
  const inv = await prisma.inventory.findUnique({
    where: { productId },
    include: { product: { select: { id: true, productCode: true, name: true, unit: true } } },
  });
  if (!inv) throw httpError(404, 'Inventory not found', 'INVENTORY_NOT_FOUND');

  return {
    productId,
    productCode: inv.product.productCode,
    productName: inv.product.name,
    unit: inv.product.unit,
    physicalQty: inv.physicalQty,
    reservedQty: inv.reservedQty,
    availableQty: inv.physicalQty - inv.reservedQty,
    damagedQty: inv.damagedQty,
  };
};

export const listInventory = async () => {
  const rows = await prisma.inventory.findMany({
    include: { product: { select: { id: true, productCode: true, name: true, unit: true, isActive: true } } },
  });
  return rows.map((inv) => ({
    productId: inv.productId,
    productCode: inv.product.productCode,
    productName: inv.product.name,
    unit: inv.product.unit,
    isActive: inv.product.isActive,
    physicalQty: inv.physicalQty,
    reservedQty: inv.reservedQty,
    availableQty: inv.physicalQty - inv.reservedQty,
    damagedQty: inv.damagedQty,
  }));
};