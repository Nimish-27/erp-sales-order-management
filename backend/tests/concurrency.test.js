import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/db.js';

/**
 * This test fires N simultaneous confirm requests against orders
 * that draw from a small, shared inventory pool.
 *
 * Expected: exactly floor(pool / per-order) succeed, the rest get 409.
 * If the row lock works, this passes. If it doesn't, you'll see over-reservation.
 */
describe('Inventory Concurrency Under Load', () => {
  let adminToken, salesToken;
  let customerId, productId;
  const POOL_SIZE = 10;          // physical inventory
  const PER_ORDER = 2;            // each order requests 2
  const NUM_ORDERS = 10;          // 10 orders × 2 = 20 demanded, only 10 available

  let orderIds = [];

  beforeAll(async () => {
    // Clean
    await prisma.$transaction([
      prisma.reservation.deleteMany(),
      prisma.dispatchItem.deleteMany(), prisma.dispatch.deleteMany(),
      prisma.salesOrderItem.deleteMany(), prisma.salesOrder.deleteMany(),
      prisma.quotationItem.deleteMany(), prisma.quotation.deleteMany(),
      prisma.enquiryItem.deleteMany(), prisma.enquiry.deleteMany(),
      prisma.inventory.deleteMany(), prisma.product.deleteMany(),
      prisma.customer.deleteMany(), prisma.user.deleteMany(),
    ]);

    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('Password@123', 12);
    await prisma.user.createMany({
      data: [
        { email: 'admin@test.com', passwordHash: hash, role: 'ADMIN' },
        { email: 'sales@test.com', passwordHash: hash, role: 'SALES' },
      ],
    });

    customerId = (await prisma.customer.create({ data: { companyName: 'Race Co', email: 'r@x.com' } })).id;
    productId = (await prisma.product.create({
      data: { productCode: 'RACE-1', name: 'Race Widget', category: 'Test', unit: 'pcs', basePrice: '10.00', gstPercent: '18.00' },
    })).id;

    await prisma.inventory.create({
      data: { productId, physicalQty: POOL_SIZE, reservedQty: 0 },
    });

    adminToken = (await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Password@123' })).body.data.token;
    salesToken = (await request(app).post('/api/auth/login').send({ email: 'sales@test.com', password: 'Password@123' })).body.data.token;

    // Create NUM_ORDERS orders, each drawing PER_ORDER units
    for (let i = 0; i < NUM_ORDERS; i++) {
      const enq = await request(app).post('/api/enquiries').set('Authorization', `Bearer ${salesToken}`)
        .send({ customerId, items: [{ productId, quantity: PER_ORDER }] });
      const qt = await request(app).post('/api/quotations').set('Authorization', `Bearer ${salesToken}`)
        .send({ enquiryId: enq.body.data.id, items: [{ productId, quantity: PER_ORDER }] });
      await request(app).patch(`/api/quotations/${qt.body.data.id}/status`).set('Authorization', `Bearer ${salesToken}`).send({ status: 'SENT' });
      await request(app).patch(`/api/quotations/${qt.body.data.id}/status`).set('Authorization', `Bearer ${salesToken}`).send({ status: 'ACCEPTED' });
      const so = await request(app).post(`/api/quotations/${qt.body.data.id}/convert`).set('Authorization', `Bearer ${salesToken}`);
      orderIds.push(so.body.data.id);
    }
  });

  afterAll(async () => await prisma.$disconnect());

  test(`${NUM_ORDERS} simultaneous confirm requests on pool of ${POOL_SIZE} → exactly ${POOL_SIZE / PER_ORDER} succeed`, async () => {
    // Fire all confirm requests in parallel — no await between them
    const promises = orderIds.map((id) =>
      request(app)
        .post(`/api/inventory/orders/${id}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`)
    );

    const results = await Promise.all(promises);

    const successes = results.filter((r) => r.status === 200);
    const failures  = results.filter((r) => r.status === 409);

    // ─── THE CORE ASSERTION ───
    expect(successes.length).toBe(POOL_SIZE / PER_ORDER);  // 5
    expect(failures.length).toBe(NUM_ORDERS - POOL_SIZE / PER_ORDER); // 5

    // Every failure must be a stock error, not a crash
    for (const fail of failures) {
      expect(fail.body.code).toBe('INSUFFICIENT_STOCK');
    }

    // ─── INVARIANT: reserved_qty must NEVER exceed physical_qty ───
    const inv = await prisma.inventory.findUnique({ where: { productId } });
    expect(inv.reservedQty).toBeLessThanOrEqual(inv.physicalQty);
    expect(inv.reservedQty).toBe(successes.length * PER_ORDER); // exactly 10

    // ─── Audit: exactly N reservation rows ───
    const reservations = await prisma.reservation.findMany({ where: { productId } });
    expect(reservations).toHaveLength(successes.length * 1); // 1 item per order

    // ─── DB-level CHECK constraint still holds ───
    // This will throw if reserved > physical (it can't, because we just verified)
    await expect(
      prisma.$queryRaw`SELECT 1 FROM "Inventory" WHERE "productId" = ${productId} AND "reservedQty" > "physicalQty"`
    ).resolves.toHaveLength(0);
  });

  test('Race condition audit: sum of successful order quantities ≤ physical stock', async () => {
    const successfulOrderIds = orderIds.slice(0, POOL_SIZE / PER_ORDER);
    const sum = await prisma.salesOrderItem.aggregate({
      where: { salesOrderId: { in: successfulOrderIds } },
      _sum: { quantity: true },
    });
    const inv = await prisma.inventory.findUnique({ where: { productId } });

    expect(Number(sum._sum.quantity)).toBeLessThanOrEqual(inv.physicalQty);
    expect(Number(sum._sum.quantity)).toBe(inv.reservedQty);
  });
});