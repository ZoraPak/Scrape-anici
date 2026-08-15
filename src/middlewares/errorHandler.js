/**
 * Global error handler middleware.
 * Menangkap error yang dilempar via next(err) dari mana saja.
 */

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  const message = err.message || 'Terjadi kesalahan pada server.';

  console.error(`[ERROR] ${req.method} ${req.originalUrl} → ${message}`);
  if (status === 500) {
    console.error(err.stack);
  }

  res.status(status).json({
    success: false,
    message,
  });
}

module.exports = errorHandler;
