import { enquiryRepository } from './enquiry.repository.js';
import { httpError } from '../../shared/errors.js';

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

  async list(filters) {
    return enquiryRepository.findAll(filters);
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

    return enquiryRepository.update(id, data);
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

import { prisma } from '../../config/db.js'; // for service-level checks