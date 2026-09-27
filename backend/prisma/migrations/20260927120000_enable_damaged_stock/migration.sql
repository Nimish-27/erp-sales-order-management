-- Normalize legacy nullable damage counts and enforce a consistent stock total.
UPDATE "inventory" SET "damaged_qty" = 0 WHERE "damaged_qty" IS NULL;

ALTER TABLE "inventory"
  ALTER COLUMN "damaged_qty" SET DEFAULT 0,
  ALTER COLUMN "damaged_qty" SET NOT NULL;

ALTER TABLE "inventory"
  ADD CONSTRAINT "inventory_reserved_plus_damaged_le_physical"
  CHECK ("reserved_qty" + "damaged_qty" <= "physical_qty");
