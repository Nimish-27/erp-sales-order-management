import { Router } from 'express';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { prisma } from '../../config/db.js';
import { httpError } from '../../shared/errors.js';

const router = Router();

router.get(
  '/',
  authorize('ADMIN', 'SALES', 'WAREHOUSE', 'VIEWER'),
  asyncHandler(async (_req, res) => {
    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { companyName: 'asc' },
    });
    res.json({ success: true, data: customers });
  })
);

router.post('/', authorize('ADMIN'), asyncHandler(async (req, res) => {
  const { companyName, contactPerson, mobile, email, city } = req.body;
  if (!companyName?.trim()) throw httpError(400, 'Company name is required', 'VALIDATION_ERROR');
  const customer = await prisma.customer.create({
    data: { companyName: companyName.trim(), contactPerson, mobile, email, city },
  });
  res.status(201).json({ success: true, data: customer });
}));

router.patch('/:id', authorize('ADMIN'), asyncHandler(async (req, res) => {
  const { companyName, contactPerson, mobile, email, city } = req.body;
  try {
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: { companyName, contactPerson, mobile, email, city },
    });
    res.json({ success: true, data: customer });
  } catch (error) {
    if (error.code === 'P2025') throw httpError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');
    throw error;
  }
}));

router.delete('/:id', authorize('ADMIN'), asyncHandler(async (req, res) => {
  try {
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true, data: customer });
  } catch (error) {
    if (error.code === 'P2025') throw httpError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');
    throw error;
  }
}));

export default router;
