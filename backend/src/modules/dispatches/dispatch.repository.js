import { prisma } from '../../config/db.js';
import { Prisma } from '@prisma/client';

export const dispatchRepository = {
  async generateDispatchNumber(tx) {
    const prefix = `DSP-${new Date().getFullYear()}-`;
    const rows = await tx.$queryRaw`
      SELECT "dispatch_number" FROM "dispatches"
      WHERE "dispatch_number" LIKE ${prefix + '%'}
      ORDER BY "dispatch_number" DESC
      LIMIT 1
      FOR UPDATE`;
    const seq = rows.length ? Number(rows[0].dispatch_number.split('-').pop()) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  },

  async findById(id) {
    return prisma.dispatch.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, salesOrder: true },
    });
  },

  async findBySalesOrderId(salesOrderId, tx = prisma) {
    return tx.dispatch.findFirst({ where: { salesOrderId } });
  },

  async create(tx, { salesOrderId, dispatchNumber, vehicleNumber, driverName, items }) {
    return tx.dispatch.create({
      data: {
        dispatchNumber,
        salesOrderId,
        vehicleNumber: vehicleNumber || null,
        driverName:    driverName    || null,
        items: { create: items.map(({ productId, quantity }) => ({ productId, quantity })) },
      },
      include: { items: true, salesOrder: true },
    });
  },

  async updateStatus(tx, id, status) {
    return tx.dispatch.update({
      where: { id },
      data: { status },
      include: { items: true, salesOrder: true },
    });
  },
};
