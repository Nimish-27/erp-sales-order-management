import { enquiryRepository } from './enquiry.repository.js';
import { httpError } from '../../shared/errors.js';
import { prisma } from '../../config/db.js';

const TRANSITIONS = {
  OPEN:   ['CANCELLED'],
  QUOTED: ['CLOSED', 'CANCELLED'],
  // CLOSED, CANCELLED are terminal
};

export const enquiryService = {
  async create(data, userId) {
    // Verify customer exists
    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) throw httpError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');

    // Verify all products exist and are active
    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      throw httpError(400, 'One or more products not found or inactive', 'PRODUCT_INVALID');
    }

    return enquiryRepository.create(data, userId);
  },

  async list(filters, { skip = 0, limit = 20 } = {}) {
    return enquiryRepository.findAll(filters, { skip, limit });
  },

  async getById(id) {
    const enquiry = await enquiryRepository.findById(id);
    if (!enquiry) throw httpError(404, 'Enquiry not found', 'ENQUIRY_NOT_FOUND');
    return enquiry;
  },

  async update(id, data) {
    const exists = await enquiryRepository.exists(id);
    if (!exists) throw httpError(404, 'Enquiry not found', 'ENQUIRY_NOT_FOUND');

    // If updating items, validate products
    if (data.items) {
      const productIds = data.items.map((i) => i.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: { id: true },
      });
      if (products.length !== productIds.length) {
        throw httpError(400, 'One or more products not found or inactive', 'PRODUCT_INVALID');
      }
    }

    const { status: _status, ...safeData } = data;
    return enquiryRepository.update(id, safeData);
  },

  async transitionStatus(id, newStatus) {
    const enquiry = await enquiryRepository.findById(id);
    if (!enquiry) throw httpError(404, 'Enquiry not found', 'ENQUIRY_NOT_FOUND');

    const allowed = TRANSITIONS[enquiry.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw httpError(
        409,
        `Invalid status transition: ${enquiry.status} → ${newStatus}. Allowed: ${allowed?.join(', ') || 'none'}`,
        'INVALID_TRANSITION'
      );
    }

    return enquiryRepository.updateStatus(id, newStatus);
  },

  async delete(id) {
    const exists = await enquiryRepository.exists(id);
    if (!exists) throw httpError(404, 'Enquiry not found', 'ENQUIRY_NOT_FOUND');

    // Check if any quotation exists (business rule: can't delete if quoted)
    const quoteCount = await prisma.quotation.count({ where: { enquiryId: id } });
    if (quoteCount > 0) {
      throw httpError(409, 'Cannot delete enquiry with existing quotations', 'ENQUIRY_HAS_QUOTATIONS');
    }

    return enquiryRepository.delete(id);
  },
};
