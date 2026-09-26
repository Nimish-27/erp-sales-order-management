import { z } from 'zod';

export const orderIdParam = z.object({ id: z.string().uuid() });

export const quotationIdParam = z.object({ id: z.string().uuid() });

export const updateOrderSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const statusTransitionSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED']), // Valid from CREATED
});

export const validate = (schema) => (req, _res, next) => {
  const data = req.params.id ? { ...req.body, ...req.params } : req.body;
  const result = schema.safeParse(data);
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