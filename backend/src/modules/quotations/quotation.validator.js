import { z } from 'zod';

export const createQuotationSchema = z.object({
  enquiryId: z.string().uuid(),
  validUntil: z.string().datetime().optional().nullable(),
  notes: z.string().max(2000).optional(),
  // Items are OPTIONAL — if omitted, we pull from enquiry items with product base_price
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative().optional(),      // defaults to product.base_price
      discountPct: z.number().min(0).max(100).optional(), // defaults to 0
      gstPct: z.number().min(0).max(100).optional(),      // defaults to product.gst_percent
    })
  ).optional(),
});

export const updateQuotationSchema = z.object({
  validUntil: z.string().datetime().optional().nullable(),
  notes: z.string().max(2000).optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative().optional(),
      discountPct: z.number().min(0).max(100).optional(),
      gstPct: z.number().min(0).max(100).optional(),
    })
  ).optional(),
});

export const quotationIdParam = z.object({ id: z.string().uuid() });

export const statusTransitionSchema = z.object({
  status: z.enum(['SENT', 'ACCEPTED', 'REJECTED']), // Only valid transitions from DRAFT/SENT
});

export const validate = (schema) => (req, _res, next) => {
  const data = req.params.id ? { ...req.body, ...req.params } : req.body;
  const validator = typeof schema.safeParse === 'function' ? schema : z.object(schema);
  const result = validator.safeParse(data);
  if (!result.success) {
    return next({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: result.error.flatten(),
    });
  }
  Object.assign(req, result.data);
  next();
};