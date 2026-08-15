/**
 * Middleware: proteksi endpoint internal (refresh cache).
 *
 * Dua lapis proteksi:
 *   1. IP whitelist  — hanya localhost / server sendiri yang boleh akses
 *   2. Secret header — X-Internal-Secret harus cocok dengan env INTERNAL_SECRET
 *
 * Kalau INTERNAL_SECRET tidak diset di env, endpoint ini SELALU ditolak
 * (lebih aman daripada defaultnya terbuka).
 */

const ALLOWED_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function internalOnly(req, res, next) {
  const ip     = req.ip || req.socket?.remoteAddress || '';
  const secret = req.headers['x-internal-secret'];
  const envSecret = process.env.INTERNAL_SECRET;

  // Wajib set INTERNAL_SECRET di env
  if (!envSecret) {
    return res.status(503).json({
      success: false,
      message: 'Endpoint internal tidak aktif (INTERNAL_SECRET belum dikonfigurasi).',
    });
  }

  // Cek IP
  if (!ALLOWED_IPS.has(ip)) {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak.',
    });
  }

  // Cek secret header
  if (!secret || secret !== envSecret) {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak.',
    });
  }

  next();
}

module.exports = internalOnly;
