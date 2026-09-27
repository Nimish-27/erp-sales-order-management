import { prisma } from '../../config/db.js';
import { Prisma } from '@prisma/client';

/**
 * Sweep orphaned reservations: CONFIRMED reservations whose sales order has
 * been CANCELLED but whose reservedQty was never released (should not happen
 * via normal flow, but guards against partial failures or manual DB edits).
 *
 * NOTE: The system does NOT use PENDING reservations with expiresAt.
 * All reservations are created as CONFIRMED by confirmSalesOrder and released
 * atomically by cancelSalesOrder. This sweeper is a safety net only.
 */
export const sweepExpiredReservations = async () => {
  // Find CONFIRMED reservations whose order is CANCELLED
  const orphaned = await prisma.reservation.findMany({
    where: {
      status: 'CONFIRMED',
      order: { status: 'CANCELLED' },
    },
    select: { id: true, productId: true, quantity: true, orderId: true },
  });

  let swept = 0;
  for (const r of orphaned) {
    await prisma.$transaction(async (tx) => {
      // Re-check inside tx to avoid double-release races
      const reservation = await tx.reservation.findUnique({
        where: { id: r.id },
        select: { status: true },
      });
      // Another process may have already released it
      if (!reservation || reservation.status !== 'CONFIRMED') return;

      await tx.$queryRaw(Prisma.sql`SELECT "product_id" FROM "inventory" WHERE "product_id" = ${r.productId} FOR UPDATE`);

      await tx.inventory.update({
        where: { productId: r.productId },
        data: { reservedQty: { decrement: r.quantity } },
      });
      await tx.reservation.update({
        where: { id: r.id },
        data: { status: 'CANCELLED' },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    swept++;
  }

  if (swept > 0) {
    console.warn(`[sweeper] Released ${swept} orphaned reservation(s) for cancelled orders`);
  }
  return { swept };
};
