import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { httpError } from '../shared/errors.js';

export const signToken = (payload) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw httpError(401, 'Invalid or expired token', 'AUTH_TOKEN_INVALID');
  }
};