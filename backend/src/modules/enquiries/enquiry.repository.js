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
    const last = await tx.enquiry.findFirst({
      where: { enquiryNumber: { startsWith: prefix } },
      orderBy: { enquiryNumber: 'desc' },
      select: { enquiryNumber: true },
    });
    const seq = last ? parseInt(last.enquiryNumber.split('-').pop(), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  },

  async findAll(filters = {}) {
    const where = {};
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.status) where.status = filters.status;
    if (filters.fromDate || filters.toDate) {
      where.enquiryDate = {};
      if (filters.fromDate) where.enquiryDate.gte = new Date(filters.fromDate);
      if (filters.toDate) where.enquiryDate.lte = new Date(filters.toDate);
    }

    return prisma.enquiry.findMany({
      where,
      include: {
        customer: { select: { id: true, companyName: true } },
        items: { include: { product: { select: { id: true, productCode: true, name: true, unit: true } } } },
        quotations: { select: { id: true, quotationNumber: true, status: true } },
      },
      orderBy: { enquiryDate: 'desc' },
    });
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

  async delete(id) {
    return prisma.enquiry.delete({ where: { id } });
  },

  async exists(id) {
    const count = await prisma.enquiry.count({ where: { id } });
    return count > 0;
  },
};