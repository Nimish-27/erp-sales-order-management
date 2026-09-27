import { Router } from 'express';
import { z } from 'zod';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { prisma } from '../../config/db.js';
import { httpError } from '../../shared/errors.js';
import { parsePagination, paginatedResponse } from '../../shared/pagination.js';

const customerSchema = z.object({
  companyName:   z.string().trim().min(2, 'Company name must be at least 2 characters').max(200),
  contactPerson: z.string().trim().min(2, 'Contact person must be at least 2 characters').max(100),
  mobile:        z.string().trim().transform((value) => value.replace(/[\s().-]/g, ''))
    .refine((value) => /^\+\d{11,13}$/.test(value), 'Enter a country code followed by a 10-digit phone number'),
  email:         z.string().trim().email('Enter a valid email address').max(254),
  city:          z.string().trim().min(2, 'City must be at least 2 characters').max(100),
});

const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next({ status: 400, code: 'VALIDATION_ERROR', message: 'Invalid request', details: result.error.flatten() });
  }
  req.body = result.data;
  next();
};

const router = Router();

router.get(
  '/',
  authorize('ADMIN', 'SALES', 'WAREHOUSE', 'VIEWER'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const where = { isActive: true };
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({ where, orderBy: { companyName: 'asc' }, skip, take: limit }),
      prisma.customer.count({ where }),
    ]);
    res.json({ success: true, ...paginatedResponse(customers, total, page, limit) });
  })
);

router.post('/', authorize('ADMIN', 'SALES'), validate(customerSchema), asyncHandler(async (req, res) => {
  const customer = await prisma.customer.create({ data: req.body });
  res.status(201).json({ success: true, data: customer });
}));

router.patch('/:id', authorize('ADMIN'), validate(customerSchema.partial()), asyncHandler(async (req, res) => {
  try {
    const customer = await prisma.customer.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: customer });
  } catch (error) {
    if (error.code === 'P2025') throw httpError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');
    throw error;
  }
}));

router.delete('/:id', authorize('ADMIN'), asyncHandler(async (req, res) => {
  try {
    const customer = await prisma.customer.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, data: customer });
  } catch (error) {
    if (error.code === 'P2025') throw httpError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');
    throw error;
  }
}));

export default router;
