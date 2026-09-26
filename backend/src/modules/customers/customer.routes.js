import { Router } from 'express';
import { authorize } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { prisma } from '../../config/db.js';

const router = Router();

router.get(
  '/',
  authorize('ADMIN', 'SALES', 'WAREHOUSE', 'VIEWER'),
  asyncHandler(async (_req, res) => {
    const customers = await prisma.customer.findMany({
      orderBy: { companyName: 'asc' },
    });
    res.json({ success: true, data: customers });
  })
);

export default router;
