import { z } from 'zod';

export const dispatchOrderSchema = z.object({
  id:            z.string().uuid(),
  vehicleNumber: z.string().trim().min(3, 'Vehicle number is required').max(20)
    .regex(/^[A-Za-z0-9][A-Za-z0-9 .-]*$/, 'Enter a valid vehicle number'),
  driverName:    z.string().trim().min(2, 'Driver name is required').max(100)
    .regex(/^[\p{L}][\p{L} .'-]*$/u, 'Enter a valid driver name'),
});

export const dispatchIdParam = z.object({ id: z.string().uuid() });

export const dispatchStatusSchema = z.object({
  id:     z.string().uuid(),
  status: z.enum(['IN_TRANSIT', 'DELIVERED']),
});

export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse({ ...req.body, ...req.params });
  if (!result.success) {
    return next({ status: 400, code: 'VALIDATION_ERROR', message: 'Invalid request', details: result.error.flatten() });
  }
  Object.assign(req, result.data);
  next();
};
