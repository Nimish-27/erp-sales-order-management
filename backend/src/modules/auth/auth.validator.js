import { z } from 'zod';

export const loginSchema = z.object({
  email:    z.string().email().max(255).transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1).max(128),
});

export const registerSchema = z.object({
  email: z.string({ required_error: 'Email is required' })
    .email('Enter a valid email address')
    .max(255)
    .transform((v) => v.toLowerCase().trim()),
  password: z.string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or fewer'),
  role: z.enum(['SALES', 'WAREHOUSE']).default('SALES'),
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