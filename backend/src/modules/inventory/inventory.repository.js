import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Atomically reserve stock for a product.
 * Uses SELECT ... FOR UPDATE inside a Serializable transaction.
 * This is the ONLY safe way to prevent over-sell under concurrency.
 */
export const reserveStockTx = async ({ productId, userId, quantity, ttlSeconds = 900 }) => {
  return prisma.$transaction(async (tx) => {
    // 1. Lock the inventory row. Any concurrent tx hitting this row will WAIT here.
    const rows = await tx.$queryRaw(
      Prisma.sql`SELECT id, "quantityTotal", "quantityReserved"
                 FROM "Inventory"
                 WHERE "productId" = ${productId}
                 FOR UPDATE`
    );

    if (rows.length === 0) {
      const err = new Error('Product inventory not found');
      err.status = 404;
      throw err;
    }

    const inv = rows[0];
    const available = inv.quantityTotal - inv.quantityReserved;

    if (available < quantity) {
      const err = new Error(`Insufficient stock. Available: ${available}, requested: ${quantity}`);
      err.status = 409;
      throw err;
    }

    // 2. Increment reserved count (still inside the lock)
    await tx.inventory.update({
      where: { productId },
      data: { quantityReserved: { increment: quantity } },
    });

    // 3. Create reservation record
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const reservation = await tx.reservation.create({
      data: { productId, userId, quantity, expiresAt, status: 'PENDING' },
    });

    return reservation;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 10000,
  });
};

/**
 * Confirm a reservation → convert soft-lock to actual sale.
 */
export const confirmReservationTx = async ({ reservationId, userId }) => {
  return prisma.$transaction(async (tx) => {
    // Lock the reservation row
    const resRows = await tx.$queryRaw(
      Prisma.sql`SELECT * FROM "Reservation"
                 WHERE id = ${reservationId} AND "userId" = ${userId}
                 FOR UPDATE`
    );

    if (resRows.length === 0) {
      const err = new Error('Reservation not found');
      err.status = 404;
      throw err;
    }

    const res = resRows[0];
    if (res.status !== 'PENDING') {
      const err = new Error(`Cannot confirm reservation in status ${res.status}`);
      err.status = 409;
      throw err;
    }
    if (new Date(res.expiresAt) < new Date()) {
      const err = new Error('Reservation expired');
      err.status = 410;
      throw err;
    }

    // Lock inventory row
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "Inventory" WHERE "productId" = ${res.productId} FOR UPDATE`
    );

    // Decrement both total and reserved
    await tx.inventory.update({
      where: { productId: res.productId },
      data: {
        quantityTotal: { decrement: res.quantity },
        quantityReserved: { decrement: res.quantity },
      },
    });

    await tx.reservation.update({
      where: { id: reservationId },
      data: { status: 'CONFIRMED' },
    });

    return { ok: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};

/**
 * Cancel/release a reservation → free soft-lock.
 */
export const releaseReservationTx = async ({ reservationId, userId }) => {
  return prisma.$transaction(async (tx) => {
    const resRows = await tx.$queryRaw(
      Prisma.sql`SELECT * FROM "Reservation"
                 WHERE id = ${reservationId} AND "userId" = ${userId}
                 FOR UPDATE`
    );

    if (resRows.length === 0) {
      const err = new Error('Reservation not found');
      err.status = 404;
      throw err;
    }

    const res = resRows[0];
    if (res.status !== 'PENDING') {
      return { ok: true, alreadyReleased: true };
    }

    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "Inventory" WHERE "productId" = ${res.productId} FOR UPDATE`
    );

    await tx.inventory.update({
      where: { productId: res.productId },
      data: { quantityReserved: { decrement: res.quantity } },
    });

    await tx.reservation.update({
      where: { id: reservationId },
      data: { status: 'CANCELLED' },
    });

    return { ok: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
};