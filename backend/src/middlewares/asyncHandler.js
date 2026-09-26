// Wraps an async route handler so rejections flow into the error middleware.
// Without this, a `throw` inside an async function becomes an unhandled rejection.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);