import { prisma } from '../../config/db.js';
import { Prisma } from '@prisma/client';

export const sweepExpiredReservations = async () => {
  const now = new Date();
  const expired = await prisma.reservation.findMany({
    where: { status: 'PENDING', expiresAt: { lt: now } },
    select: { id: true, productId: true, quantity: true },
  });

  for (const r of expired) {
    await prisma.$transaction(async (tx) => {
      // Lock both rows in deterministic order to avoid deadlocks
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Reservation" WHERE id = ${r.id} FOR UPDATE`);
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Inventory" WHERE "productId" = ${r.productId} FOR UPDATE`);

      await tx.inventory.update({
        where: { productId: r.productId },
        data: { quantityReserved: { decrement: r.quantity } },
      });
      await tx.reservation.update({
        where: { id: r.id },
        data: { status: 'EXPIRED' },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  return { swept: expired.length };
};