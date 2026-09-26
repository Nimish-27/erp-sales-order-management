import { env } from '../config/env.js';

export const errorHandler = (err, _req, res, _next) => {
  const status = err.status || 500;
  const payload = {
    success: false,
    error: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR',
  };
  if (err.details) payload.details = err.details;

  if (status >= 500) {
    console.error('[ERROR]', err);
  }
  if (env.NODE_ENV === 'development' && status >= 500) {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
};