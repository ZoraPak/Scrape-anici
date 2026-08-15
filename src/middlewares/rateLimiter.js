const rateLimit = require('express-rate-limit');
const redis     = require('../config/redis');

/**
 * Rate limiter menggunakan memory store (built-in express-rate-limit).
 * Tidak bergantung Redis sama sekali — tidak bisa crash karena Redis.
 *
 * Catatan: memory store tidak terpusat antar instance, tapi untuk
 * single-instance di Railway ini sudah cukup.
 */

function tooManyRequests(req, res, next, options) {
  const retryAfter = Math.ceil(options.windowMs / 1000);
  res.set('Retry-After', retryAfter);
  res.status(429).json({
    success:    false,
    message:    `Terlalu banyak request. Coba lagi dalam ${retryAfter} detik.`,
    retryAfter,
  });
}

// 60 request / menit / IP — semua endpoint
const general = rateLimit({
  windowMs:        60 * 1000,
  max:             60,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         tooManyRequests,
});

// 20 request / menit / IP — /detail dan /stream
const strict = rateLimit({
  windowMs:        60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         tooManyRequests,
});

// 10 request / menit / IP — search
const search = rateLimit({
  windowMs:        60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         tooManyRequests,
});

module.exports = { general, strict, search };
