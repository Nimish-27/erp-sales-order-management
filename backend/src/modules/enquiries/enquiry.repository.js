import { prisma } from '../../config/db.js';
import { Prisma } from '@prisma/client';

export const enquiryRepository = {
  async create(data, userId) {
    return prisma.$transaction(async (tx) => {
      const enquiry = await tx.enquiry.create({
        data: {
          enquiryNumber: await this.generateEnquiryNumber(tx),
          customerId: data.customerId,
          requiredDate: data.requiredDate ? new Date(data.requiredDate) : null,
          notes: data.notes,
          status: 'OPEN',
          items: {
            create: data.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
            })),
          },
        },
        include: { items: { include: { product: true } }, customer: true },
      });
      return enquiry;
    });
  },

  async generateEnquiryNumber(tx) {
    const year = new Date().getFullYear();
    const prefix = `ENQ-${year}-`;
    const rows = await tx.$queryRaw`
      SELECT "enquiry_number" FROM "enquiries"
      WHERE "enquiry_number" LIKE ${prefix + '%'}
      ORDER BY "enquiry_number" DESC
      LIMIT 1
      FOR UPDATE`;
    const seq = rows.length ? parseInt(rows[0].enquiry_number.split('-').pop(), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  },

  async findAll(filters = {}, { skip = 0, limit = 20 } = {}) {
    const where = {};
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.status) where.status = filters.status;
    if (filters.fromDate || filters.toDate) {
      where.enquiryDate = {};
      if (filters.fromDate) where.enquiryDate.gte = filters.fromDate;
      if (filters.toDate) where.enquiryDate.lte = filters.toDate;
    }
    const [data, total] = await Promise.all([
      prisma.enquiry.findMany({
        where,
        include: {
          customer: { select: { id: true, companyName: true } },
          items: { include: { product: { select: { id: true, productCode: true, name: true, unit: true } } } },
          quotations: { select: { id: true, quotationNumber: true, status: true } },
        },
        orderBy: { enquiryDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.enquiry.count({ where }),
    ]);
    return { data, total };
  },

  async findById(id) {
    return prisma.enquiry.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } },
        quotations: { include: { items: { include: { product: true } } } },
      },
    });
  },

  async update(id, data) {
    return prisma.$transaction(async (tx) => {
      if (data.items) {
        // Replace all items
        await tx.enquiryItem.deleteMany({ where: { enquiryId: id } });
        await tx.enquiryItem.createMany({
          data: data.items.map((i) => ({ enquiryId: id, productId: i.productId, quantity: i.quantity })),
        });
      }

      const { items, ...rest } = data;
      return tx.enquiry.update({
        where: { id },
        data: {
          ...rest,
          requiredDate: data.requiredDate ? new Date(data.requiredDate) : undefined,
        },
        include: { items: { include: { product: true } }, customer: true },
      });
    });
  },

  async updateStatus(id, newStatus) {
    return prisma.enquiry.update({
      where: { id },
      data: { status: newStatus },
      include: { items: { include: { product: true } }, customer: true },
    });
  },

  async delete(id) {
    return prisma.enquiry.delete({ where: { id } });
  },

  async exists(id) {
    const count = await prisma.enquiry.count({ where: { id } });
    return count > 0;
  },
};