"use strict";

function createRateLimiter(options) {
  const windowMs = options.windowMs;
  const max = options.max;
  const buckets = new Map();
  let calls = 0;

  function cleanup(now) {
    buckets.forEach(function (bucket, key) {
      if (now - bucket.start >= windowMs) buckets.delete(key);
    });
  }

  function take(key) {
    const now = Date.now();
    calls += 1;
    if (calls % 1000 === 0) cleanup(now);

    const bucket = buckets.get(key);
    if (!bucket || now - bucket.start >= windowMs) {
      buckets.set(key, { start: now, count: 1 });
      return true;
    }
    if (bucket.count >= max) return false;
    bucket.count += 1;
    return true;
  }

  function middleware(keyFn) {
    return function (req, res, next) {
      const key = keyFn(req);
      if (take(key)) {
        next();
        return;
      }
      res.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
      res.status(429).json({ error: "Too many requests" });
    };
  }

  return {
    take,
    middleware
  };
}

module.exports = {
  createRateLimiter
};
