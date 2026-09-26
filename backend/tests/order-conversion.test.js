import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/db.js';

describe('Quotation → Sales Order Conversion', () => {
  let adminToken, salesToken;
  let customerId, productId1, productId2, enquiryId, quotationId;

  beforeAll(async () => {
    // Clean slate
    await prisma.$transaction([
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

    const cust = await prisma.customer.create({
      data: { companyName: 'Test Corp', email: 't@test.com' },
    });
    customerId = cust.id;

    const [p1, p2] = await prisma.product.createManyAndReturn({
      data: [
        { productCode: 'P-TEST-1', name: 'Product 1', category: 'Cat', unit: 'pcs', basePrice: '100.00', gstPercent: '18.00' },
        { productCode: 'P-TEST-2', name: 'Product 2', category: 'Cat', unit: 'pcs', basePrice: '200.00', gstPercent: '18.00' },
      ],
    });
    productId1 = p1.id;
    productId2 = p2.id;

    await prisma.inventory.createMany({
      data: [
        { productId: productId1, physicalQty: 100, reservedQty: 0 },
        { productId: productId2, physicalQty: 50, reservedQty: 0 },
      ],
    });

    adminToken = (await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Password@123' })).body.data.token;
    salesToken = (await request(app).post('/api/auth/login').send({ email: 'sales@test.com', password: 'Password@123' })).body.data.token;

    // Create enquiry + quotation + accept it
    const enquiry = await request(app)
      .post('/api/enquiries')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ customerId, items: [{ productId: productId1, quantity: 10 }, { productId: productId2, quantity: 5 }] });
    enquiryId = enquiry.body.data.id;

    const quote = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ enquiryId, items: [{ productId: productId1, quantity: 10 }, { productId: productId2, quantity: 5 }] });
    quotationId = quote.body.data.id;

    // DRAFT → SENT → ACCEPTED
    await request(app).patch(`/api/quotations/${quotationId}/status`).set('Authorization', `Bearer ${salesToken}`).send({ status: 'SENT' });
    await request(app).patch(`/api/quotations/${quotationId}/status`).set('Authorization', `Bearer ${salesToken}`).send({ status: 'ACCEPTED' });
  });

  afterAll(async () => await prisma.$disconnect());

  // -------- CONVERSION TESTS --------

  test('POST /api/quotations/:id/convert → 201 with copied items', async () => {
    const res = await request(app)
      .post(`/api/quotations/${quotationId}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);

    expect(res.status).toBe(201);
    expect(res.body.data.orderNumber).toMatch(/^SO-\d{4}-\d{4}$/);
    expect(res.body.data.status).toBe('CREATED');
    expect(res.body.data.customerId).toBe(customerId);
    expect(res.body.data.quotationId).toBe(quotationId);
    expect(res.body.data.items).toHaveLength(2);

    // Line items copied (prices frozen)
    const item1 = res.body.data.items.find((i) => i.productId === productId1);
    const item2 = res.body.data.items.find((i) => i.productId === productId2);
    expect(item1.quantity).toBe(10);
    expect(item2.quantity).toBe(5);
    expect(parseFloat(item1.unitPrice)).toBeCloseTo(100.00, 2);
    expect(parseFloat(item2.unitPrice)).toBeCloseTo(200.00, 2);

    // Total = quote grandTotal
    expect(parseFloat(res.body.data.totalAmount)).toBeCloseTo(parseFloat(res.body.data.quotation.grandTotal), 2);
  });

  test('POST /api/quotations/:id/convert (second time) → 409 ORDER_ALREADY_EXISTS', async () => {
    const res = await request(app)
      .post(`/api/quotations/${quotationId}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ORDER_ALREADY_EXISTS');
    expect(res.body.error).toMatch(/already exists/i);
  });

  test('Convert a DRAFT quotation → 409 QUOTATION_NOT_ACCEPTED', async () => {
    // Create a new enquiry + quotation (still DRAFT)
    const enquiry = await request(app)
      .post('/api/enquiries')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ customerId, items: [{ productId: productId1, quantity: 1 }] });
    const newEnqId = enquiry.body.data.id;

    const draftQuote = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ enquiryId: newEnqId, items: [{ productId: productId1, quantity: 1 }] });
    const draftQuoteId = draftQuote.body.data.id;

    const res = await request(app)
      .post(`/api/quotations/${draftQuoteId}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('QUOTATION_NOT_ACCEPTED');
  });

  test('Convert a SENT (not yet ACCEPTED) quotation → 409', async () => {
    const enquiry = await request(app)
      .post('/api/enquiries')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ customerId, items: [{ productId: productId1, quantity: 1 }] });
    const newEnqId = enquiry.body.data.id;

    const sentQuote = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ enquiryId: newEnqId, items: [{ productId: productId1, quantity: 1 }] });
    const sentQuoteId = sentQuote.body.data.id;

    await request(app)
      .patch(`/api/quotations/${sentQuoteId}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'SENT' });

    const res = await request(app)
      .post(`/api/quotations/${sentQuoteId}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('QUOTATION_NOT_ACCEPTED');
  });

  test('Convert non-existent quotation → 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .post(`/api/quotations/${fakeId}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('QUOTATION_NOT_FOUND');
  });

  test('Convert without auth → 401', async () => {
    const res = await request(app).post(`/api/quotations/${quotationId}/convert`);
    expect(res.status).toBe(401);
  });

  test('Convert as VIEWER (read-only role) → 403', async () => {
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('Password@123', 12);
    await prisma.user.create({ data: { email: 'viewer@test.com', passwordHash: hash, role: 'VIEWER' } });
    const viewerToken = (await request(app).post('/api/auth/login').send({ email: 'viewer@test.com', password: 'Password@123' })).body.data.token;

    const res = await request(app)
      .post(`/api/quotations/${quotationId}/convert`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });

  // -------- DB-LEVEL CONSTRAINT VERIFICATION --------

  test('Direct DB insert with duplicate quotation_id → fails with unique_violation', async () => {
    const existingOrder = await prisma.salesOrder.findUnique({ where: { quotationId } });

    // Attempt to bypass app logic and insert directly
    await expect(
      prisma.salesOrder.create({
        data: {
          orderNumber: 'SO-DUP-TEST',
          customerId,
          quotationId, // ← duplicate!
          totalAmount: '999.99',
        },
      })
    ).rejects.toThrow();
  });

  // -------- STATUS TRANSITIONS --------

  test('PATCH /api/orders/:id/status CREATED→CONFIRMED → 200', async () => {
    const order = await prisma.salesOrder.findUnique({ where: { quotationId } });
    const res = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'CONFIRMED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CONFIRMED');
  });

  test('PATCH /api/orders/:id/status CONFIRMED→CANCELLED by SALES → 403', async () => {
    const order = await prisma.salesOrder.findFirst({ where: { status: 'CONFIRMED' } });
    const res = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'CANCELLED' });
    expect(res.status).toBe(403);
  });

  test('PATCH /api/orders/:id/status CONFIRMED→CANCELLED by ADMIN → 200', async () => {
    const order = await prisma.salesOrder.findFirst({ where: { status: 'CONFIRMED' } });
    const res = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CANCELLED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
  });
});