import { z } from 'zod';

export const createEnquirySchema = z.object({
  customerId: z.string().uuid(),
  requiredDate: z.string().datetime().optional().nullable(),
  notes: z.string().max(2000).optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
    })
  ).min(1, 'At least one item required'),
});

export const updateEnquirySchema = z.object({
  requiredDate: z.string().datetime().optional().nullable(),
  notes: z.string().max(2000).optional(),
  status: z.enum(['OPEN', 'QUOTED', 'CLOSED', 'CANCELLED']).optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
    })
  ).optional(),
});

export const enquiryIdParam = z.object({
  id: z.string().uuid(),
});

export const validate = (schema) => (req, _res, next) => {
  const validator = typeof schema.safeParse === 'function' ? schema : z.object(schema);
  const result = validator.safeParse(req.params.id ? { ...req.body, ...req.params } : req.body);
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