import bcrypt from 'bcrypt';
import { prisma } from '../../config/db.js';
import { httpError } from '../../shared/errors.js';
import { signToken } from '../../utils/token.js';
import { env } from '../../config/env.js';

export const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, email: true, passwordHash: true, role: true, isActive: true },
  });

  // Constant-ish message to avoid user enumeration
  if (!user || !user.isActive) {
    throw httpError(401, 'Invalid credentials', 'AUTH_INVALID');
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw httpError(401, 'Invalid credentials', 'AUTH_INVALID');

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    token,
    user: { id: user.id, email: user.email, role: user.role },
  };
};

export const me = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, isActive: true, createdAt: true },
  });
  if (!user || !user.isActive) throw httpError(404, 'User not found', 'USER_NOT_FOUND');
  return user;
};