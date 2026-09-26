import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV:        z.enum(['development', 'test', 'production']).default('development'),
  PORT:            z.coerce.number().int().positive().default(4000),
  DATABASE_URL:    z.string().url(),
  JWT_SECRET:      z.string().min(32, 'JWT_SECRET must be ≥32 chars'),
  JWT_EXPIRES_IN:  z.string().default('1d'),
  BCRYPT_ROUNDS:   z.coerce.number().int().min(10).max(15).default(12),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;