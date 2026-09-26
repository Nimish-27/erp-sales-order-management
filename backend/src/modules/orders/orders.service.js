import { prisma } from '../../config/db.js';
import { orderRepository } from './order.repository.js';
import { httpError } from '../../shared/errors.js';
import { Prisma } from '@prisma/client';

// Allowed transitions for SalesOrder
const TRANSITIONS = {
  CREATED:    ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:  ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED'],
  DELIVERED:  [], // terminal
  CANCELLED:  [], // terminal
};

export const orderService = {
  /**
   * Convert an ACCEPTED quotation into a Sales Order.
   *
   * Guard clauses (in order):
   * 1. Quotation must exist
   * 2. Quotation.status === 'ACCEPTED'
   * 3. No existing sales_order for this quotation_id (explicit pre-check)
   *    — DB UNIQUE on sales_orders.quotation_id is the backstop
   */
  async convertFromQuotation(quotationId, userId) {
    // Guard 1: Quotation must exist
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        items: { include: { product: true } },
        customer: true,
      },
    });
    if (!quotation) {
      throw httpError(404, 'Quotation not found', 'QUOTATION_NOT_FOUND');
    }

    // Guard 2: Must be ACCEPTED
    if (quotation.status !== 'ACCEPTED') {
      throw httpError(
        409,
        `Cannot convert quotation in status ${quotation.status}. Only ACCEPTED quotations can be converted.`,
        'QUOTATION_NOT_ACCEPTED'
      );
    }

    // Guard 3: Pre-check for existing order (clean error before hitting DB constraint)
    const existing = await orderRepository.findByQuotationId(quotationId);
    if (existing) {
      throw httpError(
        409,
        `Sales order already exists for this quotation: ${existing.orderNumber}`,
        'ORDER_ALREADY_EXISTS'
      );
    }

    // Generate order number and create (DB UNIQUE catches any race)
    const orderNumber = await orderRepository.generateOrderNumber(prisma);
    try {
      const order = await orderRepository.createFromQuotation(quotation, orderNumber);
      return order;
    } catch (err) {
      // P2002 = Prisma unique constraint violation
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw httpError(
          409,
          'Sales order already exists for this quotation (race condition caught)',
          'ORDER_ALREADY_EXISTS'
        );
      }
      throw err;
    }
  },

  async list(filters) {
    return orderRepository.findAll(filters);
  },

  async getById(id) {
    const order = await orderRepository.findById(id);
    if (!order) throw httpError(404, 'Sales order not found', 'ORDER_NOT_FOUND');
    return order;
  },

  async transitionStatus(id, newStatus, userRole) {
    const order = await orderRepository.findById(id);
    if (!order) throw httpError(404, 'Sales order not found', 'ORDER_NOT_FOUND');

    // Check transition
    const allowed = TRANSITIONS[order.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw httpError(
        409,
        `Invalid status transition: ${order.status} → ${newStatus}. Allowed: ${allowed?.join(', ') || 'none'}`,
        'INVALID_TRANSITION'
      );
    }

    // Role gate for sensitive transitions
    if (newStatus === 'CANCELLED' && userRole !== 'ADMIN') {
      throw httpError(403, 'Only ADMIN can cancel orders', 'INSUFFICIENT_ROLE');
    }

    return orderRepository.updateStatus(id, newStatus);
  },
};