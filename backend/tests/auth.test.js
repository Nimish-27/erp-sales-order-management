import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/db.js';

describe('Auth & RBAC', () => {
  let adminCookie;
  let salesCookie;

  beforeAll(async () => {
    await prisma.user.deleteMany();
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('Password@123', 12);
    await prisma.user.createMany({
      data: [
        { email: 'admin@inventory.local', passwordHash: hash, role: 'ADMIN' },
        { email: 'sales@inventory.local', passwordHash: hash, role: 'SALES' },
      ],
    });
  });

  afterAll(async () => await prisma.$disconnect());

  test('POST /auth/login with valid creds → 200 + HTTP-only cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@inventory.local', password: 'Password@123' });
    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie']?.[0];
    expect(setCookie).toContain('HttpOnly');
    expect(res.body.data.token).toBeUndefined();
    expect(res.body.data.user.role).toBe('ADMIN');
    adminCookie = setCookie.split(';')[0];
  });

  test('POST /auth/login with bad password → 401 (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@inventory.local', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  test('Protected route without token → 401', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });

  test('Protected route with garbage token → 401', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Cookie', 'token=not-a-real-jwt');
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me with valid token → user info', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('admin@inventory.local');
  });

  test('SALES cannot POST /api/products (ADMIN-only)', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sales@inventory.local', password: 'Password@123' });
    salesCookie = login.headers['set-cookie'][0].split(';')[0];

    const res = await request(app)
      .post('/api/products')
      .set('Cookie', salesCookie)
      .send({ productCode: 'X-1', name: 'x', category: 'y', unit: 'pcs', basePrice: '1.00' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('RBAC_FORBIDDEN');
  });

  test('ADMIN can POST /api/products', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', adminCookie)
      .send({ productCode: 'TEST-001', name: 'Test', category: 'Misc', unit: 'pcs', basePrice: '10.00' });
    expect(res.status).toBe(201);
  });

  test('SALES CAN list /api/products (read-all)', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Cookie', salesCookie);
    expect(res.status).toBe(200);
  });

  test('Login with malformed email → 400 validation error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});