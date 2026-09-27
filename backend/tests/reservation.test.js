import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/db.js';

describe('Inventory Reservation — Confirm Order', () => {
  let adminCookie, salesCookie;
  let customerId, productId1, productId2, orderId;

  beforeAll(async () => {
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

    customerId = (await prisma.customer.create({ data: { companyName: 'Test Corp', email: 't@test.com' } })).id;

    const [p1, p2] = await prisma.product.createManyAndReturn({
      data: [
        { productCode: 'P-TEST-1', name: 'Product 1', category: 'Cat', unit: 'pcs', basePrice: '100.00', gstPercent: '18.00' },
        { productCode: 'P-TEST-2', name: 'Product 2', category: 'Cat', unit: 'pcs', basePrice: '200.00', gstPercent: '18.00' },
      ],
    });
    productId1 = p1.id;
    productId2 = p2.id;

    // Tight stock: P1 has 10 physical, P2 has 3 physical
    await prisma.inventory.createMany({
      data: [
        { productId: productId1, physicalQty: 10, reservedQty: 0 },
        { productId: productId2, physicalQty: 3,  reservedQty: 0 },
      ],
    });

    adminCookie = (await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Password@123' })).headers['set-cookie'][0].split(';')[0];
    salesCookie = (await request(app).post('/api/auth/login').send({ email: 'sales@test.com', password: 'Password@123' })).headers['set-cookie'][0].split(';')[0];

    // Setup: enquiry → quote → accept → convert to order
    const enq = await request(app).post('/api/enquiries').set('Cookie', salesCookie)
      .send({ customerId, items: [{ productId: productId1, quantity: 5 }, { productId: productId2, quantity: 3 }] });
    const enqId = enq.body.data.id;

    const qt = await request(app).post('/api/quotations').set('Cookie', salesCookie)
      .send({ enquiryId: enqId, items: [{ productId: productId1, quantity: 5 }, { productId: productId2, quantity: 3 }] });
    const qtId = qt.body.data.id;

    await request(app).patch(`/api/quotations/${qtId}/status`).set('Cookie', salesCookie).send({ status: 'SENT' });
    await request(app).patch(`/api/quotations/${qtId}/status`).set('Cookie', salesCookie).send({ status: 'ACCEPTED' });

    const so = await request(app).post(`/api/orders/quotations/${qtId}/convert`).set('Cookie', salesCookie);
    orderId = so.body.data.id;
  });

  afterAll(async () => await prisma.$disconnect());

  // -------- HAPPY PATH --------

  test('POST /api/orders/:id/confirm → reserves stock, sets CONFIRMED', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/confirm`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CONFIRMED');

    // Verify reservation was created
    const reservations = await prisma.reservation.findMany({ where: { orderId } });
    expect(reservations).toHaveLength(2);

    // Verify reserved_qty was bumped
    const inv1 = await prisma.inventory.findUnique({ where: { productId: productId1 } });
    const inv2 = await prisma.inventory.findUnique({ where: { productId: productId2 } });
    expect(inv1.reservedQty).toBe(5);
    expect(inv2.reservedQty).toBe(3);
  });

  test('GET /api/inventory → shows updated available quantities', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .set('Cookie', adminCookie);
    expect(res.status).toBe(200);

    const p1 = res.body.data.find((i) => i.productId === productId1);
    const p2 = res.body.data.find((i) => i.productId === productId2);
    expect(p1.availableQty).toBe(5);   // 10 - 5
    expect(p2.availableQty).toBe(0);   // 3 - 3
  });

  // -------- RBAC --------

  test('SALES cannot confirm order → 403', async () => {
    // Create a new order to test
    const enq = await request(app).post('/api/enquiries').set('Cookie', salesCookie)
      .send({ customerId, items: [{ productId: productId1, quantity: 1 }] });
    const qt = await request(app).post('/api/quotations').set('Cookie', salesCookie)
      .send({ enquiryId: enq.body.data.id, items: [{ productId: productId1, quantity: 1 }] });
    await request(app).patch(`/api/quotations/${qt.body.data.id}/status`).set('Cookie', salesCookie).send({ status: 'SENT' });
    await request(app).patch(`/api/quotations/${qt.body.data.id}/status`).set('Cookie', salesCookie).send({ status: 'ACCEPTED' });
    const so = await request(app).post(`/api/orders/quotations/${qt.body.data.id}/convert`).set('Cookie', salesCookie);

    const res = await request(app)
      .post(`/api/orders/${so.body.data.id}/confirm`)
      .set('Cookie', salesCookie);
    expect(res.status).toBe(403);
  });

  // -------- FAILURE: INSUFFICIENT STOCK --------

  test('Confirm order exceeding stock → 409 INSUFFICIENT_STOCK, no state change', async () => {
    // P2 has 3 physical, 3 reserved (from previous test) → 0 available
    // Create new order requesting 2 of P2 → should fail
    const enq = await request(app).post('/api/enquiries').set('Cookie', salesCookie)
      .send({ customerId, items: [{ productId: productId2, quantity: 2 }] });
    const qt = await request(app).post('/api/quotations').set('Cookie', salesCookie)
      .send({ enquiryId: enq.body.data.id, items: [{ productId: productId2, quantity: 2 }] });
    await request(app).patch(`/api/quotations/${qt.body.data.id}/status`).set('Cookie', salesCookie).send({ status: 'SENT' });
    await request(app).patch(`/api/quotations/${qt.body.data.id}/status`).set('Cookie', salesCookie).send({ status: 'ACCEPTED' });
    const so = await request(app).post(`/api/orders/quotations/${qt.body.data.id}/convert`).set('Cookie', salesCookie);

    // Snapshot stock before failed attempt
    const invBefore = await prisma.inventory.findUnique({ where: { productId: productId2 } });

    const res = await request(app)
      .post(`/api/orders/${so.body.data.id}/confirm`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.details.failures).toBeDefined();
    expect(res.body.details.failures[0]).toMatchObject({
      productId: productId2,
      requested: 2,
      available: 0,
      shortBy: 2,
    });

    // CRITICAL: stock unchanged
    const invAfter = await prisma.inventory.findUnique({ where: { productId: productId2 } });
    expect(invAfter.reservedQty).toBe(invBefore.reservedQty);

    // Order status unchanged
    const orderAfter = await prisma.salesOrder.findUnique({ where: { id: so.body.data.id } });
    expect(orderAfter.status).toBe('CREATED');
  });

  // -------- IDEMPOTENCY / STATE GUARD --------

  test('Confirming an already-CONFIRMED order → 409 ORDER_NOT_CONFIRMABLE', async () => {
    const res = await request(app)
      .post(`/api/orders/${orderId}/confirm`)
      .set('Cookie', adminCookie);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ORDER_NOT_CONFIRMABLE');
  });

  // -------- VALIDATION --------

  test('Invalid order ID format → 400', async () => {
    const res = await request(app)
      .post('/api/orders/not-a-uuid/confirm')
      .set('Cookie', adminCookie);
    expect(res.status).toBe(400);
  });
});