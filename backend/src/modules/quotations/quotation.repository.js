import { prisma } from '../../config/db.js';
import { Prisma } from '@prisma/client';

export const quotationRepository = {
  async create(data, computed) {
    return prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.create({
        data: {
          quotationNumber: await this.generateQuotationNumber(tx),
          enquiryId: data.enquiryId,
          customerId: data.customerId,
          status: 'DRAFT',
          validUntil: data.validUntil ? new Date(data.validUntil) : null,
          notes: data.notes,
          grandTotal: computed.grandTotal,
          items: {
            create: computed.itemsWithComputed.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountPct: item.discountPct ?? 0,
              gstPct: item.gstPct ?? 18,
              lineAmount: item.lineAmount,
            })),
          },
        },
        include: { items: { include: { product: true } }, enquiry: true, customer: true },
      });

      // Update enquiry status to QUOTED
      await tx.enquiry.update({
        where: { id: data.enquiryId },
        data: { status: 'QUOTED' },
      });

      return quotation;
    });
  },

  async generateQuotationNumber(tx) {
    const year = new Date().getFullYear();
    const prefix = `QT-${year}-`;
    const last = await tx.quotation.findFirst({
      where: { quotationNumber: { startsWith: prefix } },
      orderBy: { quotationNumber: 'desc' },
      select: { quotationNumber: true },
    });
    const seq = last ? parseInt(last.quotationNumber.split('-').pop(), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  },

  async findAll(filters = {}) {
    const where = {};
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.enquiryId) where.enquiryId = filters.enquiryId;
    if (filters.status) where.status = filters.status;

    return prisma.quotation.findMany({
      where,
      include: {
        customer: { select: { id: true, companyName: true } },
        enquiry: { select: { id: true, enquiryNumber: true } },
        items: { include: { product: { select: { id: true, productCode: true, name: true, unit: true } } } },
        order: { select: { id: true, orderNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id) {
    return prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        enquiry: { include: { items: { include: { product: true } } } },
        items: { include: { product: true } },
        order: true,
      },
    });
  },

  async update(id, data, computed) {
    return prisma.$transaction(async (tx) => {
      if (computed) {
        // Replace items
        await tx.quotationItem.deleteMany({ where: { quotationId: id } });
        await tx.quotationItem.createMany({
          data: computed.itemsWithComputed.map((item) => ({
            quotationId: id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPct: item.discountPct ?? 0,
            gstPct: item.gstPct ?? 18,
            lineAmount: item.lineAmount,
          })),
        });
      }

      const { items, ...rest } = data;
      return tx.quotation.update({
        where: { id },
        data: {
          ...rest,
          grandTotal: computed?.grandTotal,
          validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        },
        include: { items: { include: { product: true } }, customer: true, enquiry: true },
      });
    });
  },

  async updateStatus(id, newStatus) {
    return prisma.quotation.update({
      where: { id },
      data: { status: newStatus },
      include: { items: { include: { product: true } }, customer: true, enquiry: true },
    });
  },

  async delete(id) {
    return prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.findUnique({ where: { id } });
      if (!quotation) return null;

      // If quotation was ACCEPTED and has an order, prevent deletion
      if (quotation.status === 'ACCEPTED') {
        const order = await tx.salesOrder.findUnique({ where: { quotationId: id } });
        if (order) throw new Error('QUOTATION_HAS_ORDER');
      }

      await tx.quotation.delete({ where: { id } });

      // Check if enquiry has other quotations; if not, revert to OPEN
      const otherQuotes = await tx.quotation.count({ where: { enquiryId: quotation.enquiryId } });
      if (otherQuotes === 0) {
        await tx.enquiry.update({ where: { id: quotation.enquiryId }, data: { status: 'OPEN' } });
      }

      return { ok: true };
    });
  },
};