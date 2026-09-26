import express from 'express';
import { errorHandler } from './middlewares/errorHandler.js';
import { authenticate } from './middlewares/auth.js';

import authRoutes      from './modules/auth/auth.routes.js';
import productRoutes   from './modules/products/product.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import reservationRoutes from './modules/reservations/reservation.routes.js';
import enquiryRoutes   from './modules/enquiries/enquiry.routes.js';
import quotationRoutes from './modules/quotations/quotation.routes.js';
import orderRoutes     from './modules/orders/order.routes.js';
import dispatchRoutes  from './modules/dispatches/dispatch.routes.js';

export const app = express();
app.use(express.json({ limit: '1mb' }));

// -------- Public --------
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);                 // login is public; /me is guarded inside

// -------- Protected (everything below requires a valid JWT) --------
app.use('/api', authenticate);                   // <-- single line guards everything

app.use('/api/products',   productRoutes);
app.use('/api/inventory',  inventoryRoutes);
app.use('/api/inventory',  reservationRoutes);
app.use('/api/enquiries',  enquiryRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/orders',     orderRoutes);
app.use('/api/dispatches', dispatchRoutes);

// -------- Final error catch-all --------
app.use(errorHandler);