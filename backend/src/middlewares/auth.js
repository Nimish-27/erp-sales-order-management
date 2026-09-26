import { verifyToken } from '../utils/token.js';
import { httpError } from '../shared/errors.js';

/**
 * Verifies the Authorization: Bearer <jwt> header and attaches {id, role, email}
 * to req.user. Throws 401 on any failure — never leaks the specific reason.
 */
export const authenticate = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(httpError(401, 'Authentication required', 'AUTH_MISSING'));
  }

  const token = header.slice(7).trim();
  if (!token) return next(httpError(401, 'Authentication required', 'AUTH_MISSING'));

  try {
    const payload = verifyToken(token);
    req.user = {
      id:    payload.sub,
      email: payload.email,
      role:  payload.role,
    };
    next();
  } catch (err) {
    next(err); // 401 from verifyToken
  }
};

/**
 * Role-based gate. Must run AFTER authenticate.
 * Usage: router.post('/x', authenticate, authorize('ADMIN'), handler)
 */
export const authorize = (...allowedRoles) => (req, _res, next) => {
  if (!req.user) return next(httpError(401, 'Authentication required', 'AUTH_MISSING'));
  if (!allowedRoles.includes(req.user.role)) {
    return next(httpError(403, 'Insufficient permissions', 'RBAC_FORBIDDEN'));
  }
  next();
};