import { prisma } from '../config/db.js';

/**
 * Write an audit log entry. Fire-and-forget — never throws.
 */
export const audit = (req, action, entityType, entityId, { oldValue, newValue } = {}) => {
  prisma.auditLog.create({
    data: {
      userId:     req.user?.id   ?? null,
      action,
      entityType,
      entityId,
      oldValue:   oldValue ?? undefined,
      newValue:   newValue ?? undefined,
      ipAddress:  req.ip   ?? null,
      userAgent:  req.headers?.['user-agent'] ?? null,
    },
  }).catch((err) => console.error('[audit] write failed:', err.message));
};
