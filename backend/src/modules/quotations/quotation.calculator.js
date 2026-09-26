import { Decimal } from 'decimal.js';

/**
 * Compute line amount: qty × unit_price × (1 - discount_pct/100) × (1 + gst_pct/100)
 * All inputs as strings/numbers → Decimal for precision.
 */
export const computeLine = ({ quantity, unitPrice, discountPct = 0, gstPct = 18 }) => {
  const qty = new Decimal(quantity);
  const price = new Decimal(unitPrice);
  const disc = new Decimal(discountPct).div(100);
  const gst = new Decimal(gstPct).div(100);

  const base = qty.mul(price);
  const afterDisc = base.mul(new Decimal(1).minus(disc));
  const withGst = afterDisc.mul(new Decimal(1).plus(gst));

  return {
    baseAmount: base.toFixed(2),
    discountAmount: base.minus(afterDisc).toFixed(2),
    gstAmount: withGst.minus(afterDisc).toFixed(2),
    lineAmount: withGst.toFixed(2),
  };
};

/**
 * Recompute entire quotation from items.
 * Returns { grandTotal, itemsWithComputed }
 */
export const computeQuotation = (items) => {
  let grandTotal = new Decimal(0);
  const itemsWithComputed = items.map((item) => {
    const computed = computeLine(item);
    grandTotal = grandTotal.plus(computed.lineAmount);
    return { ...item, ...computed };
  });
  return { grandTotal: grandTotal.toFixed(2), itemsWithComputed };
};