/**
 * Cache helper berbasis Redis.
 * Semua key otomatis diberi prefix "anichin:" agar mudah diidentifikasi.
 *
 * TTL defaults (detik):
 *   home      → 5 menit   (konten berubah cukup sering)
 *   ongoing   → 10 menit
 *   completed → 30 menit  (jarang berubah)
 *   schedule  → 1 jam
 *   detail    → 15 menit
 *   stream    → 10 menit
 */

const redis = require('../config/redis');

const PREFIX = 'anichin:';

const TTL = {
  home:      5  * 60,
  ongoing:   10 * 60,
  completed: 30 * 60,
  schedule:  60 * 60,
  detail:    15 * 60,
  stream:    10 * 60,
};

/**
 * Ambil data dari cache.
 * @returns {any|null} data yang di-parse, atau null jika tidak ada / Redis mati
 */
async function get(key) {
  try {
    const raw = await redis.get(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // Redis mati → cache miss, lanjut scraping
  }
}

/**
 * Simpan data ke cache dengan TTL.
 * @param {string} key
 * @param {any}    data
 * @param {number} ttlSeconds
 */
async function set(key, data, ttlSeconds) {
  try {
    await redis.set(PREFIX + key, JSON.stringify(data), 'EX', ttlSeconds);
  } catch {
    // silent — Redis mati bukan alasan untuk gagal
  }
}

/**
 * Hapus satu key (untuk endpoint refresh).
 */
async function del(key) {
  try {
    await redis.del(PREFIX + key);
  } catch {}
}

/**
 * Hapus semua key dengan prefix pattern (misal: "detail:*").
 */
async function delPattern(pattern) {
  try {
    const keys = await redis.keys(PREFIX + pattern);
    if (keys.length) await redis.del(...keys);
  } catch {}
}

module.exports = { get, set, del, delPattern, TTL };
