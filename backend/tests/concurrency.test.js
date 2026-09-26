import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/db.js';

describe('Inventory concurrency', () => {
  beforeAll(async () => {
    await prisma.reservation.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();

    const product = await prisma.product.create({
      data: { sku: 'TEST-1', name: 'Test', price: '100.00', gstPercent: '18.00' },
    });
    await prisma.inventory.create({
      data: { productId: product.id, quantityTotal: 5, quantityReserved: 0 },
    });
    const user = await prisma.user.create({
      data: { email: 't@t.com', passwordHash: 'x', role: 'CUSTOMER' },
    });
    global.__productId = product.id;
    global.__userId = user.id;
  });

  it('should never over-sell under concurrent reservations', async () => {
    const promises = Array.from({ length: 20 }, () =>
      request(app).post('/api/reservations').send({
        productId: global.__productId,
        quantity: 1,
      })
    );

    const results = await Promise.all(promises);
    const successes = results.filter((r) => r.status === 201);
    const conflicts = results.filter((r) => r.status === 409);

    expect(successes.length).toBe(5);    // exactly the stock
    expect(conflicts.length).toBe(15);   // rest rejected

    const inv = await prisma.inventory.findUnique({
      where: { productId: global.__productId },
    });
    expect(inv.quantityReserved).toBe(5);
  });
});