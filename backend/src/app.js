import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { errorHandler } from './middlewares/errorHandler.js';
import { authenticate } from './middlewares/auth.js';
import { env } from './config/env.js';

import authRoutes      from './modules/auth/auth.routes.js';
import productRoutes   from './modules/products/product.routes.js';
import reservationRoutes from './modules/reservations/reservation.routes.js';
import enquiryRoutes   from './modules/enquiries/enquiry.routes.js';
import quotationRoutes from './modules/quotations/quotation.routes.js';
import orderRoutes     from './modules/orders/order.routes.js';
import dispatchRoutes  from './modules/dispatches/dispatch.routes.js';
import customerRoutes  from './modules/customers/customer.routes.js';

// Allowed origins — extend for staging/prod domains
const ALLOWED_ORIGINS = env.NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:4000'];

export const app = express();

// Security headers
app.use(helmet());

// Origin / CORS — enforced in production, permissive in development (Vite proxy rewrites Origin)
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Always set CORS headers when an Origin is present
  if (origin) {
    const allowed = ALLOWED_ORIGINS.includes(origin);

    // In production, reject unknown origins outright
    if (env.NODE_ENV === 'production' && !allowed) {
      return res.status(403).json({ success: false, error: 'Origin not allowed', code: 'ORIGIN_FORBIDDEN' });
    }

    const effectiveOrigin = allowed ? origin : ALLOWED_ORIGINS[0];
    res.setHeader('Access-Control-Allow-Origin', effectiveOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// -------- Public --------
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);                 // login is public; /me is guarded inside

// -------- Protected (everything below requires a valid JWT) --------
app.use('/api', authenticate);                   // <-- single line guards everything

app.use('/api/products',   productRoutes);
app.use('/api/inventory',  reservationRoutes);
app.use('/api/enquiries',  enquiryRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/orders',     orderRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/customers',  customerRoutes);

// -------- Final error catch-all --------
app.use(errorHandler);