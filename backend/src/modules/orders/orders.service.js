import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { httpError } from '../../shared/errors.js';
import { reserveStockTx } from '../inventory/inventory.repository.js';

const DISCOUNTS = {
  'SAVE10': { type: 'percent', value: new Prisma.Decimal('0.10') },
  'FLAT50': { type: 'flat',    value: new Prisma.Decimal('50.00') },
};

export const createOrderTx = async ({ userId, items, discountCode }) => {
  // 1. Reserve stock for each item (in its own tx; partial failure handled)
  const reservations = [];
  for (const item of items) {
    try {
      const r = await reserveStockTx({
        productId: item.productId,
        userId,
        quantity: item.quantity,
      });
      reservations.push(r);
    } catch (err) {
      // rollback already-created reservations
      await Promise.allSettled(
        reservations.map((r) => releaseReservationTx({ reservationId: r.id, userId }))
      );
      throw err;
    }
  }

  try {
    // 2. Build order with money math in Decimal
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = new Prisma.Decimal(0);
    const orderItemsData = items.map((item) => {
      const p = productMap.get(item.productId);
      if (!p) throw httpError(404, `Product ${item.productId} not found`);
      const lineTotal = new Prisma.Decimal(p.price).mul(item.quantity);
      subtotal = subtotal.add(lineTotal);
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: p.price,
      };
    });

    // 3. Discount
    let discountAmt = new Prisma.Decimal(0);
    if (discountCode) {
      const d = DISCOUNTS[discountCode];
      if (!d) throw httpError(400, 'Invalid discount code');
      discountAmt = d.type === 'percent'
        ? subtotal.mul(d.value)
        : Prisma.Decimal.min(d.value, subtotal);
    }
    const afterDiscount = subtotal.sub(discountAmt);

    // 4. GST on discounted amount
    const gst = afterDiscount.mul('0.18').toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const total = afterDiscount.add(gst).toDecimalPlaces(2);

    // 5. Persist
    const order = await prisma.order.create({
      data: {
        userId,
        subtotal: subtotal.toDecimalPlaces(2),
        gstAmount: gst,
        total,
        discountCode: discountCode || null,
        discountAmt: discountAmt.toDecimalPlaces(2),
        items: { create: orderItemsData },
      },
      include: { items: true },
    });

    // 6. Link reservations → confirm them (converts soft-lock to hard deduction)
    await Promise.all(
      reservations.map((r) => confirmReservationTx({ reservationId: r.id, userId }))
    );

    return order;
  } catch (err) {
    await Promise.allSettled(
      reservations.map((r) => releaseReservationTx({ reservationId: r.id, userId }))
    );
    throw err;
  }
};