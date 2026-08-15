const rateLimit  = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const redis      = require('../config/redis');

/**
 * Buat store Redis untuk rate-limit-redis v4.
 * Jika Redis mati, library otomatis fallback ke memory store.
 */
function makeStore(prefix) {
  return new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix,
  });
}

/**
 * Handler 429 — kembalikan JSON + header Retry-After.
 */
function tooManyRequests(req, res, next, options) {
  const retryAfter = Math.ceil(options.windowMs / 1000);
  res.set('Retry-After', retryAfter);
  res.status(429).json({
    success: false,
    message: `Terlalu banyak request. Coba lagi dalam ${retryAfter} detik.`,
    retryAfter,
  });
}

// ─── Rate limiter umum (semua endpoint) ─────────────────────────────────────
// 60 request per menit per IP
const general = rateLimit({
  windowMs:         60 * 1000,
  max:              60,
  standardHeaders:  true,
  legacyHeaders:    false,
  keyGenerator:     (req) => req.ip,
  handler:          tooManyRequests,
  store:            makeStore('rl:general:'),
});

// ─── Rate limiter ketat (stream + detail) ───────────────────────────────────
// Endpoint ini paling mahal: scraping + decode base64
// 20 request per menit per IP
const strict = rateLimit({
  windowMs:         60 * 1000,
  max:              20,
  standardHeaders:  true,
  legacyHeaders:    false,
  keyGenerator:     (req) => req.ip,
  handler:          tooManyRequests,
  store:            makeStore('rl:strict:'),
});

// ─── Rate limiter search ─────────────────────────────────────────────────────
// 10 request per menit per IP
const search = rateLimit({
  windowMs:         60 * 1000,
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  keyGenerator:     (req) => req.ip,
  handler:          tooManyRequests,
  store:            makeStore('rl:search:'),
});

module.exports = { general, strict, search };
