import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database…');

  // -------- Clean (idempotent re-runs) --------
  await prisma.$transaction([
    prisma.dispatchItem.deleteMany(),
    prisma.dispatch.deleteMany(),
    prisma.salesOrderItem.deleteMany(),
    prisma.salesOrder.deleteMany(),
    prisma.quotationItem.deleteMany(),
    prisma.quotation.deleteMany(),
    prisma.enquiryItem.deleteMany(),
    prisma.enquiry.deleteMany(),
    prisma.inventory.deleteMany(),
    prisma.product.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // -------- Users (2: ADMIN + SALES) --------
  const passwordHash = await bcrypt.hash('Password@123', 12);

  const [admin, sales] = await Promise.all([
    prisma.user.create({
      data: { email: 'admin@inventory.local', passwordHash, role: 'ADMIN' },
    }),
    prisma.user.create({
      data: { email: 'sales@inventory.local', passwordHash, role: 'SALES' },
    }),
  ]);
  console.log(`  ✓ Users: ${admin.email}, ${sales.email} (password: Password@123)`);

  // -------- Customers (3) --------
  const customers = await prisma.$transaction([
    prisma.customer.create({
      data: {
        companyName: 'Acme Industries Pvt Ltd',
        contactPerson: 'Rajesh Kumar',
        mobile: '+91-9876543210',
        email: 'rajesh@acme.com',
        city: 'Mumbai',
      },
    }),
    prisma.customer.create({
      data: {
        companyName: 'Bluechip Manufacturing',
        contactPerson: 'Priya Sharma',
        mobile: '+91-9123456780',
        email: 'priya@bluechip.com',
        city: 'Pune',
      },
    }),
    prisma.customer.create({
      data: {
        companyName: 'Zenith Traders',
        contactPerson: 'Arun Mehta',
        mobile: '+91-9988776655',
        email: 'arun@zenith.com',
        city: 'Delhi',
      },
    }),
  ]);
  console.log(`  ✓ Customers: ${customers.length}`);

  // -------- Products (6) + Inventory --------
  const productSpecs = [
    { code: 'P-1001', name: 'MS Angle 50x50x6',     category: 'Steel',     unit: 'kg',  price: '85.00',  qty: 1200, reserved: 200 },
    { code: 'P-1002', name: 'MS Channel 100x50',     category: 'Steel',     unit: 'kg',  price: '92.50',  qty: 800,  reserved: 50  },
    { code: 'P-1003', name: 'GI Pipe 1"',            category: 'Pipes',     unit: 'm',   price: '145.00', qty: 500,  reserved: 0   },
    { code: 'P-1004', name: 'Copper Wire 2.5mm',     category: 'Electrical', unit: 'm',  price: '210.00', qty: 2000, reserved: 350 },
    { code: 'P-1005', name: 'Cement Bag 50kg OPC',   category: 'Building',  unit: 'bag', price: '385.00', qty: 600,  reserved: 120 },
    { code: 'P-1006', name: 'SS Rod 12mm',           category: 'Steel',     unit: 'kg',  price: '320.00', qty: 300,  reserved: 0   },
  ];

  const products = [];
  for (const spec of productSpecs) {
    const p = await prisma.product.create({
      data: {
        productCode: spec.code,
        name: spec.name,
        category: spec.category,
        unit: spec.unit,
        basePrice: spec.price,
        gstPercent: '18.00',
      },
    });

    await prisma.inventory.create({
      data: {
        productId: p.id,
        physicalQty: spec.qty,
        reservedQty: spec.reserved,
        reorderLevel: Math.floor(spec.qty * 0.1),
      },
    });

    products.push({ ...spec, id: p.id });
  }
  console.log(`  ✓ Products: ${products.length} (with inventory rows)`);

  // -------- Sample Enquiry + Quotation (so the system isn't empty) --------
  const enquiry = await prisma.enquiry.create({
    data: {
      enquiryNumber: 'ENQ-2025-0001',
      customerId: customers[0].id,
      requiredDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: 'QUOTED',
      notes: 'Urgent requirement for project site',
      items: {
        create: [
          { productId: products[0].id, quantity: 50 },
          { productId: products[2].id, quantity: 100 },
        ],
      },
    },
  });

  const quote = await prisma.quotation.create({
    data: {
      quotationNumber: 'QT-2025-0001',
      enquiryId: enquiry.id,
      customerId: customers[0].id,
      status: 'SENT',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      grandTotal: '18425.00',
      items: {
        create: [
          {
            productId: products[0].id,
            quantity: 50,
            unitPrice: '85.00',
            discountPct: '5.00',
            gstPct: '18.00',
            lineAmount: '4768.75', // 50*85*(1-0.05)*1.18
          },
          {
            productId: products[2].id,
            quantity: 100,
            unitPrice: '145.00',
            discountPct: '0.00',
            gstPct: '18.00',
            lineAmount: '17110.00',
          },
        ],
      },
    },
  });
  console.log(`  ✓ Sample enquiry ${enquiry.enquiryNumber} + quotation ${quote.quotationNumber}`);

  console.log('✅ Seed complete.\n');
  console.log('   Login credentials:');
  console.log('   ADMIN → admin@inventory.local / Password@123');
  console.log('   SALES → sales@inventory.local / Password@123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });