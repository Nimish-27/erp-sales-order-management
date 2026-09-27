import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/db.js';
import { Decimal } from 'decimal.js';

describe('Enquiry → Quotation Flow', () => {
  let adminCookie, salesCookie;
  let customerId, productId1, productId2;

  beforeAll(async () => {
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
    const [admin, sales] = await prisma.user.createManyAndReturn({
      data: [
        { email: 'admin@test.com', passwordHash: hash, role: 'ADMIN' },
        { email: 'sales@test.com', passwordHash: hash, role: 'SALES' },
      ],
    });

    const cust = await prisma.customer.create({
      data: { companyName: 'Test Corp', contactPerson: 'John', email: 'j@test.com' },
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

    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Password@123' });
    adminCookie = adminLogin.headers['set-cookie'][0].split(';')[0];
    const salesLogin = await request(app).post('/api/auth/login').send({ email: 'sales@test.com', password: 'Password@123' });
    salesCookie = salesLogin.headers['set-cookie'][0].split(';')[0];
  });

  afterAll(async () => await prisma.$disconnect());

  // -------- ENQUIRY TESTS --------
  test('POST /api/enquiries → 201 with auto-generated number', async () => {
    const res = await request(app)
      .post('/api/enquiries')
      .set('Cookie', salesCookie)
      .send({
        customerId,
        requiredDate: new Date(Date.now() + 86400000).toISOString(),
        items: [{ productId: productId1, quantity: 10 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.enquiryNumber).toMatch(/^ENQ-\d{4}-\d{4}$/);
    expect(res.body.data.status).toBe('OPEN');
    expect(res.body.data.items).toHaveLength(1);
  });

  test('GET /api/enquiries → list with filters', async () => {
    const res = await request(app)
      .get('/api/enquiries')
      .set('Cookie', salesCookie)
      .query({ customerId });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('PATCH /api/enquiries/:id → update items & status', async () => {
    const create = await request(app)
      .post('/api/enquiries')
      .set('Cookie', salesCookie)
      .send({ customerId, items: [{ productId: productId1, quantity: 5 }] });
    const id = create.body.data.id;

    const res = await request(app)
      .patch(`/api/enquiries/${id}`)
      .set('Cookie', salesCookie)
      .send({ status: 'CLOSED', items: [{ productId: productId2, quantity: 3 }] });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CLOSED');
    expect(res.body.data.items[0].productId).toBe(productId2);
  });

  // -------- QUOTATION TESTS --------
  let enquiryId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/enquiries')
      .set('Cookie', salesCookie)
      .send({ customerId, items: [{ productId: productId1, quantity: 10 }, { productId: productId2, quantity: 5 }] });
    enquiryId = res.body.data.id;
  });

  test('POST /api/quotations (no items provided) → auto-derives from enquiry with server-side calc', async () => {
    const res = await request(app)
      .post('/api/quotations')
      .set('Cookie', salesCookie)
      .send({ enquiryId, validUntil: new Date(Date.now() + 30 * 86400000).toISOString() });
    expect(res.status).toBe(201);
    expect(res.body.data.quotationNumber).toMatch(/^QT-\d{4}-\d{4}$/);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.items).toHaveLength(2);
    // Verify computation: line amounts present
    expect(res.body.data.items[0].lineAmount).toBeDefined();
    expect(typeof res.body.data.items[0].lineAmount).toBe('string');
    // Grand total should match sum of lines
    const sum = res.body.data.items.reduce((a, i) => a + parseFloat(i.lineAmount), 0);
    expect(parseFloat(res.body.data.grandTotal)).toBeCloseTo(sum, 2);
  });

  test('POST /api/quotations (with items) → uses provided prices, still recomputes', async () => {
    const res = await request(app)
      .post('/api/quotations')
      .set('Cookie', salesCookie)
      .send({
        enquiryId,
        items: [
          { productId: productId1, quantity: 2, unitPrice: '150.00', discountPct: 10, gstPct: 18 },
        ],
      });
    expect(res.status).toBe(201);
    // 2 * 150 * 0.9 * 1.18 = 318.60
    expect(parseFloat(res.body.data.items[0].lineAmount)).toBeCloseTo(318.60, 2);
    expect(parseFloat(res.body.data.grandTotal)).toBeCloseTo(318.60, 2);
  });

  test('PATCH /api/quotations/:id/status DRAFT→SENT → 200', async () => {
    const create = await request(app)
      .post('/api/quotations')
      .set('Cookie', salesCookie)
      .send({ enquiryId, items: [{ productId: productId1, quantity: 1 }] });
    const qId = create.body.data.id;

    const res = await request(app)
      .patch(`/api/quotations/${qId}/status`)
      .set('Cookie', salesCookie)
      .send({ status: 'SENT' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SENT');
  });

  test('PATCH /api/quotations/:id/status SENT→ACCEPTED → 200', async () => {
    const create = await request(app)
      .post('/api/quotations')
      .set('Cookie', salesCookie)
      .send({ enquiryId, items: [{ productId: productId1, quantity: 1 }] });
    const qId = create.body.data.id;

    await request(app)
      .patch(`/api/quotations/${qId}/status`)
      .set('Cookie', salesCookie)
      .send({ status: 'SENT' });

    const res = await request(app)
      .patch(`/api/quotations/${qId}/status`)
      .set('Cookie', salesCookie)
      .send({ status: 'ACCEPTED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ACCEPTED');
  });

  test('PATCH /api/quotations/:id/status DRAFT→ACCEPTED directly → 409 (illegal jump)', async () => {
    const create = await request(app)
      .post('/api/quotations')
      .set('Cookie', salesCookie)
      .send({ enquiryId, items: [{ productId: productId1, quantity: 1 }] });
    const qId = create.body.data.id;

    const res = await request(app)
      .patch(`/api/quotations/${qId}/status`)
      .set('Cookie', salesCookie)
      .send({ status: 'ACCEPTED' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  });

  test('PATCH /api/quotations/:id/status SENT→REJECTED → 200', async () => {
    const create = await request(app)
      .post('/api/quotations')
      .set('Cookie', salesCookie)
      .send({ enquiryId, items: [{ productId: productId1, quantity: 1 }] });
    const qId = create.body.data.id;

    await request(app)
      .patch(`/api/quotations/${qId}/status`)
      .set('Cookie', salesCookie)
      .send({ status: 'SENT' });

    const res = await request(app)
      .patch(`/api/quotations/${qId}/status`)
      .set('Cookie', salesCookie)
      .send({ status: 'REJECTED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
  });

  test('DELETE /api/quotations/:id (ACCEPTED with no order) → 204', async () => {
    const create = await request(app)
      .post('/api/quotations')
      .set('Cookie', salesCookie)
      .send({ enquiryId, items: [{ productId: productId1, quantity: 1 }] });
    const qId = create.body.data.id;

    await request(app)
      .patch(`/api/quotations/${qId}/status`)
      .set('Cookie', salesCookie)
      .send({ status: 'SENT' });
    await request(app)
      .patch(`/api/quotations/${qId}/status`)
      .set('Cookie', salesCookie)
      .send({ status: 'ACCEPTED' });

    const res = await request(app)
      .delete(`/api/orders/quotations/${qId}`)
      .set('Cookie', adminCookie);
    expect(res.status).toBe(204);
  });

  test('VIEWER role can read but not write', async () => {
    // Create viewer user
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('Password@123', 12);
    await prisma.user.create({ data: { email: 'viewer@test.com', passwordHash: hash, role: 'VIEWER' } });
    const login = await request(app).post('/api/auth/login').send({ email: 'viewer@test.com', password: 'Password@123' });
    const viewerCookie = login.headers['set-cookie'][0].split(';')[0];

    // Can read
    const getRes = await request(app).get('/api/enquiries').set('Cookie', viewerCookie);
    expect(getRes.status).toBe(200);

    // Cannot create
    const postRes = await request(app)
      .post('/api/enquiries')
      .set('Cookie', viewerCookie)
      .send({ customerId, items: [{ productId: productId1, quantity: 1 }] });
    expect(postRes.status).toBe(403);
  });
});