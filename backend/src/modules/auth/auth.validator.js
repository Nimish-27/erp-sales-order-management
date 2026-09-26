import { z } from 'zod';

export const loginSchema = z.object({
  email:    z.string().email().max(255).transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1).max(128),
});

export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request body',
      details: result.error.flatten(),
    });
  }
  req.body = result.data; // normalized/cleaned
  next();
};