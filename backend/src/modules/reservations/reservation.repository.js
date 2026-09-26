import { prisma } from '../../config/db.js';
import { Prisma } from '@prisma/client';

/**
 * Lock + read inventory for a product. MUST be called inside a transaction.
 * Returns the current state, or null if product doesn't exist.
 */
export const lockInventoryForProduct = async (tx, productId) => {
  const rows = await tx.$queryRaw(
    Prisma.sql`SELECT "product_id" AS "productId",
                      "physical_qty" AS "physicalQty",
                      "reserved_qty" AS "reservedQty"
               FROM "inventory"
               WHERE "product_id" = ${productId}
               FOR UPDATE`
  );
  return rows[0] || null;
};

/**
 * Lock ALL inventory rows for an order's products in a deterministic order
 * (prevents deadlocks). MUST be inside a transaction.
 *
 * Returns: Map<productId, {physicalQty, reservedQty}>
 * Throws if any product has no inventory row.
 */
export const lockInventoryForOrder = async (tx, productIds) => {
  // Deterministic ordering to prevent ABBA deadlocks
  const sortedIds = [...new Set(productIds)].sort();

  const inventoryMap = new Map();
  const missing = [];

  for (const pid of sortedIds) {
    const row = await lockInventoryForProduct(tx, pid);
    if (!row) {
      missing.push(pid);
      continue;
    }
    inventoryMap.set(pid, {
      physicalQty: Number(row.physicalQty),
      reservedQty: Number(row.reservedQty),
    });
  }

  if (missing.length > 0) {
    const err = new Error(`No inventory record for products: ${missing.join(', ')}`);
    err.code = 'INVENTORY_NOT_FOUND';
    err.missing = missing;
    throw err;
  }

  return inventoryMap;
};

/**
 * Increment reserved quantity for multiple products atomically.
 * MUST be called inside the SAME transaction that locked the rows.
 */
export const bumpReservedQty = async (tx, increments) => {
  // increments: [{ productId, delta }]
  for (const { productId, delta } of increments) {
    await tx.inventory.update({
      where: { productId },
      data: { reservedQty: { increment: delta } },
    });
  }
};