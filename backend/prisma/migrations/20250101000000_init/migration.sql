-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE "UserRole"        AS ENUM ('ADMIN', 'SALES', 'WAREHOUSE', 'VIEWER');
CREATE TYPE "EnquiryStatus"   AS ENUM ('OPEN', 'QUOTED', 'CLOSED', 'CANCELLED');
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');
CREATE TYPE "OrderStatus"     AS ENUM ('CREATED', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'CANCELLED');
CREATE TYPE "DispatchStatus"  AS ENUM ('PENDING', 'IN_TRANSIT', 'DELIVERED');

-- =====================================================
-- USERS
-- =====================================================
CREATE TABLE "users" (
  "id"            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"         TEXT         NOT NULL UNIQUE,
  "password_hash" TEXT         NOT NULL,
  "role"          "UserRole"   NOT NULL,
  "is_active"     BOOLEAN      NOT NULL DEFAULT TRUE,
  "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =====================================================
-- CUSTOMERS
-- =====================================================
CREATE TABLE "customers" (
  "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_name"   TEXT         NOT NULL,
  "contact_person" TEXT,
  "mobile"         TEXT,
  "email"          TEXT,
  "city"           TEXT,
  "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =====================================================
-- PRODUCTS
-- =====================================================
CREATE TABLE "products" (
  "id"           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "product_code" TEXT         NOT NULL UNIQUE,
  "name"         TEXT         NOT NULL,
  "category"     TEXT         NOT NULL,
  "unit"         TEXT         NOT NULL,
  "base_price"   NUMERIC(12,2) NOT NULL,
  "gst_percent"  NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  "is_active"    BOOLEAN      NOT NULL DEFAULT TRUE,
  "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT products_base_price_nonneg CHECK (base_price >= 0),
  CONSTRAINT products_gst_pct_range     CHECK (gst_percent >= 0 AND gst_percent <= 100)
);

-- =====================================================
-- INVENTORY — with CHECK constraints (the spec requirement)
-- =====================================================
CREATE TABLE "inventory" (
  "product_id"     UUID         PRIMARY KEY REFERENCES "products"("id") ON DELETE RESTRICT,
  "physical_qty"   INTEGER         NOT NULL,
  "reserved_qty"   INTEGER         NOT NULL DEFAULT 0,
  "damaged_qty"    INTEGER,                 -- nullable-for-later per spec
  "reorder_level"  INTEGER,
  "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Hard DB-level invariants
  CONSTRAINT inventory_physical_nonneg  CHECK (physical_qty  >= 0),
  CONSTRAINT inventory_reserved_nonneg  CHECK (reserved_qty  >= 0),
  CONSTRAINT inventory_reserved_le_phys CHECK (reserved_qty <= physical_qty),
  CONSTRAINT inventory_damaged_nonneg   CHECK (damaged_qty IS NULL OR damaged_qty >= 0)
);

-- =====================================================
-- ENQUIRIES
-- =====================================================
CREATE TABLE "enquiries" (
  "id"             UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  "enquiry_number" TEXT            NOT NULL UNIQUE,
  "customer_id"    UUID            NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
  "enquiry_date"   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  "required_date"  TIMESTAMPTZ,
  "status"         "EnquiryStatus" NOT NULL DEFAULT 'OPEN',
  "notes"          TEXT,
  "created_at"     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX "enquiries_customer_id_idx" ON "enquiries"("customer_id");
CREATE INDEX "enquiries_status_idx"      ON "enquiries"("status");

CREATE TABLE "enquiry_items" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "enquiry_id"  UUID NOT NULL REFERENCES "enquiries"("id") ON DELETE CASCADE,
  "product_id"  UUID NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "quantity"    INTEGER NOT NULL CHECK (quantity > 0),
  UNIQUE ("enquiry_id", "product_id")
);
CREATE INDEX "enquiry_items_enquiry_id_idx" ON "enquiry_items"("enquiry_id");
CREATE INDEX "enquiry_items_product_id_idx" ON "enquiry_items"("product_id");

-- =====================================================
-- QUOTATIONS
-- =====================================================
CREATE TABLE "quotations" (
  "id"              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  "quotation_number" TEXT             NOT NULL UNIQUE,
  "enquiry_id"      UUID             NOT NULL REFERENCES "enquiries"("id") ON DELETE RESTRICT,
  "customer_id"     UUID             NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
  "status"          "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
  "valid_until"     TIMESTAMPTZ,
  "grand_total"     NUMERIC(14,2)    NOT NULL DEFAULT 0,
  "notes"           TEXT,
  "created_at"      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT quotations_grand_total_nonneg CHECK (grand_total >= 0)
);
CREATE INDEX "quotations_enquiry_id_idx"  ON "quotations"("enquiry_id");
CREATE INDEX "quotations_customer_id_idx" ON "quotations"("customer_id");
CREATE INDEX "quotations_status_idx"      ON "quotations"("status");

CREATE TABLE "quotation_items" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "quotation_id" UUID NOT NULL REFERENCES "quotations"("id") ON DELETE CASCADE,
  "product_id"   UUID NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "quantity"     INTEGER NOT NULL CHECK (quantity > 0),
  "unit_price"   NUMERIC(12,2) NOT NULL,
  "discount_pct" NUMERIC(5,2)  NOT NULL DEFAULT 0,
  "gst_pct"      NUMERIC(5,2)  NOT NULL DEFAULT 18.00,
  "line_amount"  NUMERIC(14,2) NOT NULL,

  CONSTRAINT qi_qty_positive     CHECK (quantity     >  0),
  CONSTRAINT qi_price_nonneg     CHECK (unit_price   >= 0),
  CONSTRAINT qi_discount_range   CHECK (discount_pct >= 0 AND discount_pct <= 100),
  CONSTRAINT qi_gst_range        CHECK (gst_pct      >= 0 AND gst_pct      <= 100),
  CONSTRAINT qi_line_nonneg      CHECK (line_amount  >= 0)
);
CREATE INDEX "quotation_items_quotation_id_idx" ON "quotation_items"("quotation_id");
CREATE INDEX "quotation_items_product_id_idx"   ON "quotation_items"("product_id");

-- =====================================================
-- SALES ORDERS
--   - quotation_id UNIQUE → one quotation → one sales order (DB guarantee)
-- =====================================================
CREATE TABLE "sales_orders" (
  "id"           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_number" TEXT          NOT NULL UNIQUE,
  "customer_id"  UUID          NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
  "quotation_id" UUID          NOT NULL UNIQUE REFERENCES "quotations"("id") ON DELETE RESTRICT,
  "order_date"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "total_amount" NUMERIC(14,2) NOT NULL,
  "status"       "OrderStatus" NOT NULL DEFAULT 'CREATED',
  "notes"        TEXT,
  "created_at"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT so_total_nonneg CHECK (total_amount >= 0)
);
CREATE INDEX "sales_orders_customer_id_idx" ON "sales_orders"("customer_id");
CREATE INDEX "sales_orders_status_idx"      ON "sales_orders"("status");

CREATE TABLE "sales_order_items" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sales_order_id" UUID NOT NULL REFERENCES "sales_orders"("id") ON DELETE CASCADE,
  "product_id"     UUID NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "quantity"       INTEGER NOT NULL,
  "unit_price"     NUMERIC(12,2) NOT NULL,

  CONSTRAINT soi_qty_positive CHECK (quantity > 0),
  CONSTRAINT soi_price_nonneg CHECK (unit_price >= 0)
);
CREATE INDEX "sales_order_items_order_id_idx"   ON "sales_order_items"("sales_order_id");
CREATE INDEX "sales_order_items_product_id_idx" ON "sales_order_items"("product_id");

-- =====================================================
-- DISPATCHES
-- =====================================================
CREATE TABLE "dispatches" (
  "id"              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  "dispatch_number" TEXT            NOT NULL UNIQUE,
  "sales_order_id"  UUID            NOT NULL REFERENCES "sales_orders"("id") ON DELETE RESTRICT,
  "dispatch_date"   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  "vehicle_number"  TEXT,
  "driver_name"     TEXT,
  "status"          "DispatchStatus" NOT NULL DEFAULT 'PENDING',
  "notes"           TEXT,
  "created_at"      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX "dispatches_sales_order_id_idx" ON "dispatches"("sales_order_id");
CREATE INDEX "dispatches_status_idx"         ON "dispatches"("status");

CREATE TABLE "dispatch_items" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "dispatch_id" UUID NOT NULL REFERENCES "dispatches"("id") ON DELETE CASCADE,
  "product_id"  UUID NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "quantity"    INTEGER NOT NULL,

  CONSTRAINT di_qty_positive CHECK (quantity > 0)
);
CREATE INDEX "dispatch_items_dispatch_id_idx" ON "dispatch_items"("dispatch_id");
CREATE INDEX "dispatch_items_product_id_idx"  ON "dispatch_items"("product_id");