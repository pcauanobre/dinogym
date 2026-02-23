// Wraps async route handlers so errors propagate to Express's error middleware
// instead of becoming unhandled rejections.
export const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
