import express from 'express';
import { errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import productRoutes from './modules/products/product.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import reservationRoutes from './modules/reservations/reservation.routes.js';
import orderRoutes from './modules/orders/order.routes.js';
import { startExpirySweeper } from './modules/reservations/expiry.sweeper.js';

export const app = express();
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/orders', orderRoutes);

app.use(errorHandler);

startExpirySweeper(); // every 60s