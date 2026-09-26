import jwt from 'jsonwebtoken';
import { httpError } from '../shared/errors.js';

export const requireAuth = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw httpError(401, 'Missing token');
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch {
    throw httpError(401, 'Invalid or expired token');
  }
};

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) throw httpError(401, 'Unauthenticated');
  if (!roles.includes(req.user.role)) throw httpError(403, 'Forbidden');
  next();
};