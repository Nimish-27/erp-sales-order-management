import { prisma } from '../../config/db.js';

export const orderRepository = {
  /**
   * Create a Sales Order from an accepted Quotation.
   * DB-level UNIQUE on sales_orders.quotation_id guarantees one order per quote.
   */
  async createFromQuotation(quotation, orderNumber) {
    return prisma.$transaction(async (tx) => {
      // Double-check inside the transaction (race-safe)
      const existing = await tx.salesOrder.findUnique({
        where: { quotationId: quotation.id },
      });
      if (existing) {
        throw new Error('ORDER_ALREADY_EXISTS');
      }

      // Create order with copied line items (prices frozen at quote time)
      const order = await tx.salesOrder.create({
        data: {
          orderNumber,
          customerId: quotation.customerId,
          quotationId: quotation.id,
          orderDate: new Date(),
          totalAmount: quotation.grandTotal,
          status: 'CREATED',
          items: {
            create: quotation.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: {
          items: { include: { product: true } },
          customer: true,
          quotation: { include: { items: { include: { product: true } } } },
        },
      });

      return order;
    });
  },

  async generateOrderNumber(tx) {
    const year = new Date().getFullYear();
    const prefix = `SO-${year}-`;
    const last = await tx.salesOrder.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const seq = last ? parseInt(last.orderNumber.split('-').pop(), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  },

  async findAll(filters = {}) {
    const where = {};
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.status) where.status = filters.status;
    if (filters.fromDate || filters.toDate) {
      where.orderDate = {};
      if (filters.fromDate) where.orderDate.gte = new Date(filters.fromDate);
      if (filters.toDate) where.orderDate.lte = new Date(filters.toDate);
    }

    return prisma.salesOrder.findMany({
      where,
      include: {
        customer: { select: { id: true, companyName: true } },
        quotation: { select: { id: true, quotationNumber: true } },
        items: { include: { product: { select: { id: true, productCode: true, name: true, unit: true } } } },
        dispatches: { select: { id: true, dispatchNumber: true, status: true } },
      },
      orderBy: { orderDate: 'desc' },
    });
  },

  async findById(id) {
    return prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        quotation: { include: { items: { include: { product: true } } } },
        items: { include: { product: true } },
        dispatches: { include: { items: { include: { product: true } } } },
      },
    });
  },

  async updateStatus(id, newStatus) {
    return prisma.salesOrder.update({
      where: { id },
      data: { status: newStatus },
      include: { items: { include: { product: true } }, customer: true },
    });
  },

  async findByQuotationId(quotationId) {
    return prisma.salesOrder.findUnique({
      where: { quotationId },
      select: { id: true, orderNumber: true, status: true, orderDate: true },
    });
  },
};