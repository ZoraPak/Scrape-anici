/**
 * Distributed lock menggunakan Redis SET NX EX.
 *
 * Pola: 100 request bersamaan untuk slug yang sama →
 *   - Request pertama dapat lock → scraping dijalankan
 *   - Request lain menunggu (polling) hingga lock lepas
 *   - Setelah lock lepas, semua baca dari cache (tidak scraping ulang)
 *
 * Lock key: "anichin:lock:{key}"
 * TTL lock: 30 detik (maks waktu scraping wajar)
 */

const redis = require('../config/redis');

const LOCK_PREFIX = 'anichin:lock:';
const LOCK_TTL    = 30;      // detik
const POLL_INTERVAL = 100;   // ms antar polling
const POLL_TIMEOUT  = 29000; // ms maks nunggu lock orang lain

/**
 * Coba ambil lock.
 * @returns {string|null} token jika berhasil, null jika gagal
 */
async function acquire(key) {
  const token  = `${Date.now()}-${Math.random()}`;
  try {
    const result = await redis.set(
      LOCK_PREFIX + key,
      token,
      'EX', LOCK_TTL,
      'NX'
    );
    return result === 'OK' ? token : null;
  } catch {
    return token; // Redis mati → anggap dapat lock (graceful degrade)
  }
}

/**
 * Lepas lock hanya jika token cocok (Lua script untuk atomicity).
 */
async function release(key, token) {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  try {
    await redis.eval(script, 1, LOCK_PREFIX + key, token);
  } catch {}
}

/**
 * Tunggu sampai lock key hilang (orang lain sedang scraping).
 * @returns {boolean} true = lock sudah lepas, false = timeout
 */
async function waitForRelease(key) {
  const deadline = Date.now() + POLL_TIMEOUT;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    try {
      const exists = await redis.exists(LOCK_PREFIX + key);
      if (!exists) return true;
    } catch {
      return true; // Redis mati → lanjut
    }
  }
  return false; // timeout
}

/**
 * Wrapper utama: jalankan fn() dengan proteksi lock.
 *
 * Alur:
 *   1. Coba ambil lock
 *   2. Jika dapat → jalankan fn(), lepas lock, return hasil
 *   3. Jika tidak dapat → tunggu lock lepas → baca cache (caller tanggung jawab)
 *
 * @param {string}   key    - identifier unik resource
 * @param {Function} fn     - async function yang melakukan scraping
 * @param {Function} [fromCache] - async function untuk baca cache setelah tunggu
 * @returns {any}
 */
async function withLock(key, fn, fromCache) {
  const token = await acquire(key);

  if (token) {
    // Kita yang dapat lock → jalankan scraping
    try {
      return await fn();
    } finally {
      await release(key, token);
    }
  }

  // Orang lain sedang scraping → tunggu
  await waitForRelease(key);

  // Setelah lock lepas, coba baca cache hasil scraping orang lain
  if (fromCache) {
    const cached = await fromCache();
    if (cached) return cached;
  }

  // Fallback: lock timeout atau cache kosong → scraping sendiri
  return await fn();
}

module.exports = { acquire, release, waitForRelease, withLock };
