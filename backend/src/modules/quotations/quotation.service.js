import { prisma } from '../../config/db.js';
import { quotationRepository } from './quotation.repository.js';
import { computeQuotation, computeLine } from './quotation.calculator.js';
import { httpError } from '../../shared/errors.js';
import { Decimal } from 'decimal.js';

// Merge duplicate productIds by summing quantities (same price/discount/gst must match — reject if they differ)
const deduplicateItems = (items) => {
  const seen = new Map();
  for (const item of items) {
    if (seen.has(item.productId)) {
      throw httpError(400, `Duplicate product in items: ${item.productId}. Combine into a single line.`, 'DUPLICATE_PRODUCT');
    }
    seen.set(item.productId, item);
  }
  return items;
};

const TRANSITIONS = {
  DRAFT: ['SENT'],
  SENT: ['ACCEPTED', 'REJECTED'],
  // ACCEPTED, REJECTED, EXPIRED are terminal
};

export const quotationService = {
  async create(data, userId) {
    // Verify enquiry exists and is OPEN or QUOTED
    const enquiry = await prisma.enquiry.findUnique({
      where: { id: data.enquiryId },
      include: { items: { include: { product: true } }, customer: true },
    });
    if (!enquiry) throw httpError(404, 'Enquiry not found', 'ENQUIRY_NOT_FOUND');

    if (!['OPEN', 'QUOTED'].includes(enquiry.status)) {
      throw httpError(409, `Cannot create quotation for enquiry in status ${enquiry.status}`, 'INVALID_ENQUIRY_STATUS');
    }

    // Build items: use provided items OR derive from enquiry items
    let items = data.items;
    if (!items || items.length === 0) {
      items = enquiry.items.map((ei) => ({
        productId: ei.productId,
        quantity: ei.quantity,
        unitPrice: ei.product.basePrice.toString(),
        discountPct: 0,
        gstPct: ei.product.gstPercent.toString(),
      }));
    } else {
      // Validate all products exist and are active
      const productIds = items.map((i) => i.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: { id: true, basePrice: true, gstPercent: true },
      });
      if (products.length !== productIds.length) {
        throw httpError(400, 'One or more products not found or inactive', 'PRODUCT_INVALID');
      }
      // Fill defaults from product
      const productMap = new Map(products.map((p) => [p.id, p]));
      items = deduplicateItems(items).map((item) => {
        const p = productMap.get(item.productId);
        return {
          ...item,
          unitPrice: item.unitPrice ?? p.basePrice.toString(),
          gstPct: item.gstPct ?? p.gstPercent.toString(),
          discountPct: item.discountPct ?? 0,
        };
      });
    }

    // SERVER-SIDE RECOMPUTATION — never trust client totals
    const computed = computeQuotation(items);

    // Create quotation
    const quotation = await quotationRepository.create(
      { ...data, customerId: enquiry.customerId },
      computed
    );

    return quotation;
  },

  async list(filters, { skip = 0, limit = 20 } = {}) {
    return quotationRepository.findAll(filters, { skip, limit });
  },

  async getById(id) {
    const quotation = await quotationRepository.findById(id);
    if (!quotation) throw httpError(404, 'Quotation not found', 'QUOTATION_NOT_FOUND');
    return quotation;
  },

  async update(id, data, userId) {
    const quotation = await quotationRepository.findById(id);
    if (!quotation) throw httpError(404, 'Quotation not found', 'QUOTATION_NOT_FOUND');

    if (quotation.status !== 'DRAFT') {
      throw httpError(409, `Cannot update quotation in status ${quotation.status}`, 'QUOTATION_NOT_EDITABLE');
    }

    let computed;
    if (data.items) {
      // Validate products
      const productIds = data.items.map((i) => i.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: { id: true, basePrice: true, gstPercent: true },
      });
      if (products.length !== productIds.length) {
        throw httpError(400, 'One or more products not found or inactive', 'PRODUCT_INVALID');
      }
      const productMap = new Map(products.map((p) => [p.id, p]));
      const itemsWithDefaults = deduplicateItems(data.items).map((item) => {
        const p = productMap.get(item.productId);
        return {
          ...item,
          unitPrice: item.unitPrice ?? p.basePrice.toString(),
          gstPct: item.gstPct ?? p.gstPercent.toString(),
          discountPct: item.discountPct ?? 0,
        };
      });
      computed = computeQuotation(itemsWithDefaults);
    }

    const { items: _items, status: _status, ...safeData } = data;
    return quotationRepository.update(id, safeData, computed);
  },

  async transitionStatus(id, newStatus, userId) {
    const quotation = await quotationRepository.findById(id);
    if (!quotation) throw httpError(404, 'Quotation not found', 'QUOTATION_NOT_FOUND');

    const allowed = TRANSITIONS[quotation.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw httpError(409, `Invalid status transition: ${quotation.status} → ${newStatus}. Allowed: ${allowed?.join(', ') || 'none'}`, 'INVALID_TRANSITION');
    }

    // Additional guard: SENT→ACCEPTED requires validUntil not in past
    if (quotation.status === 'SENT' && newStatus === 'ACCEPTED') {
      if (quotation.validUntil && new Date(quotation.validUntil) < new Date()) {
        throw httpError(409, 'Cannot accept expired quotation', 'QUOTATION_EXPIRED');
      }
    }

    const updated = await quotationRepository.updateStatus(id, newStatus);

    // If ACCEPTED, we could auto-create a Sales Order here,
    // but per spec that's a separate explicit endpoint.
    // We'll just return the updated quotation.

    return updated;
  },

  async delete(id) {
    const quotation = await quotationRepository.findById(id);
    if (!quotation) throw httpError(404, 'Quotation not found', 'QUOTATION_NOT_FOUND');

    if (quotation.status === 'ACCEPTED') {
      const order = await prisma.salesOrder.findUnique({ where: { quotationId: id } });
      if (order) throw httpError(409, 'Cannot delete accepted quotation with existing sales order', 'QUOTATION_HAS_ORDER');
    }

    return quotationRepository.delete(id);
  },
};