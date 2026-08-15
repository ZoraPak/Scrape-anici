const rateLimit  = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const redis      = require('../config/redis');

/**
 * Buat store untuk rate limiter.
 * Kalau Redis belum siap / tidak ada → pakai memory store (default express-rate-limit).
 * Dengan begitu app tidak crash saat startup meskipun Redis belum connect.
 */
function makeStore(prefix) {
  // Cek apakah Redis sudah connect. Status 'ready' = siap dipakai.
  if (redis.status !== 'ready') {
    return undefined; // express-rate-limit pakai memory store sebagai fallback
  }

  try {
    return new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix,
    });
  } catch {
    return undefined;
  }
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

/**
 * Buat limiter dengan lazy store — store dibuat saat request pertama masuk,
 * bukan saat module di-load. Ini mencegah crash saat Redis belum siap.
 */
function makeLimiter({ windowMs, max, storePrefix }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders:   false,
    keyGenerator:    (req) => req.ip,
    handler:         tooManyRequests,
    // store dibuat lazy: dipanggil tiap request, bukan saat init
    skip: false,
    store: (() => {
      let _store;
      let _ready = false;

      // Coba buat store saat Redis siap
      redis.once('ready', () => {
        try {
          _store = new RedisStore({
            sendCommand: (...args) => redis.call(...args),
            prefix: storePrefix,
          });
          _ready = true;
        } catch {
          _ready = false;
        }
      });

      // Return proxy object yang forward ke store saat ready,
      // atau undefined agar express-rate-limit pakai memory store internal
      return {
        async increment(key) {
          if (_ready && _store) return _store.increment(key);
          // fallback: memory (express-rate-limit handle sendiri jika store tidak ada)
          return undefined;
        },
        async decrement(key) {
          if (_ready && _store) return _store.decrement(key);
        },
        async resetKey(key) {
          if (_ready && _store) return _store.resetKey(key);
        },
      };
    })(),
  });
}

// 60 request / menit / IP — semua endpoint
const general = makeLimiter({ windowMs: 60 * 1000, max: 60, storePrefix: 'rl:general:' });

// 20 request / menit / IP — /detail dan /stream (scraping berat)
const strict = makeLimiter({ windowMs: 60 * 1000, max: 20, storePrefix: 'rl:strict:' });

// 10 request / menit / IP — search
const search = makeLimiter({ windowMs: 60 * 1000, max: 10, storePrefix: 'rl:search:' });

module.exports = { general, strict, search };
