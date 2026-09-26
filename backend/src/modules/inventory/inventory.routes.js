import { Router } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { createReservation } from './inventory.controller.js';

const router = Router();
router.post('/', requireAuth, requireRole('CUSTOMER', 'STAFF', 'MANAGER', 'ADMIN'), createReservation);
router.post('/:id/confirm', requireAuth, requireRole('CUSTOMER', 'STAFF', 'MANAGER', 'ADMIN'), confirmReservation);
router.post('/:id/cancel', requireAuth, requireRole('CUSTOMER', 'STAFF', 'MANAGER', 'ADMIN'), cancelReservation);

export default router;