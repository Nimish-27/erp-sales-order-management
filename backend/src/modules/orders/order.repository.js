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
    const rows = await tx.$queryRaw`
      SELECT "order_number" FROM "sales_orders"
      WHERE "order_number" LIKE ${prefix + '%'}
      ORDER BY "order_number" DESC
      LIMIT 1
      FOR UPDATE`;
    const seq = rows.length ? parseInt(rows[0].order_number.split('-').pop(), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  },

  async findAll(filters = {}, { skip = 0, limit = 20 } = {}) {
    const where = {};
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.status) where.status = filters.status;
    if (filters.fromDate || filters.toDate) {
      where.orderDate = {};
      if (filters.fromDate) where.orderDate.gte = filters.fromDate;
      if (filters.toDate) where.orderDate.lte = filters.toDate;
    }
    const [data, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, companyName: true } },
          quotation: { select: { id: true, quotationNumber: true } },
          items: { include: { product: { select: { id: true, productCode: true, name: true, unit: true } } } },
          dispatch: { select: { id: true, dispatchNumber: true, status: true } },
        },
        orderBy: { orderDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.salesOrder.count({ where }),
    ]);
    return { data, total };
  },

  async findById(id) {
    return prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        quotation: { include: { items: { include: { product: true } } } },
        items: { include: { product: true } },
        dispatch: { include: { items: { include: { product: true } } } },
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