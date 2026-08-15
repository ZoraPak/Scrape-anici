const Redis = require('ioredis');

/**
 * Railway menyediakan REDIS_URL otomatis saat plugin Redis ditambahkan.
 * Format: redis://:password@host:port
 * Kalau tidak ada, fallback ke variabel terpisah (development lokal).
 */
function createRedisClient() {
  const options = {
    lazyConnect:        true,
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
  };

  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, options);
  }

  return new Redis({
    host:     process.env.REDIS_HOST     || '127.0.0.1',
    port:     Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db:       Number(process.env.REDIS_DB)   || 0,
    ...options,
  });
}

const redis = createRedisClient();

redis.on('connect', () => console.log('[Redis] Terhubung'));
redis.on('error',   (err) => console.warn('[Redis] Error:', err.message));
redis.on('close',   () => console.warn('[Redis] Koneksi tertutup'));

redis.connect().catch(() => {});

module.exports = redis;
