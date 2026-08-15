/**
 * Middleware: resolusi slug → URL lengkap.
 *
 * Menerima query param `slug`:
 *   - detail series : /api/detail?slug=stellar-transformation-season-5
 *   - stream episode: /api/stream?slug=stellar-transformation-season-5-episode-12
 *
 * Backend yang menambahkan prefix BASE_URL sehingga frontend tidak perlu
 * tahu struktur URL Anichin sama sekali.
 */

const BASE_URL = 'https://anichin.cafe';

/**
 * Untuk /api/detail — slug series di-prefix dengan /seri/
 */
function validateSeriesSlug(req, res, next) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({
      success: false,
      message: 'Query parameter "slug" wajib diisi. Contoh: ?slug=stellar-transformation-season-5',
    });
  }

  // Bersihkan slash sisa jika ada
  const clean = slug.replace(/^\/+|\/+$/g, '');
  req.validatedUrl = `${BASE_URL}/seri/${clean}/`;
  req.slug = clean;
  next();
}

/**
 * Untuk /api/stream — slug episode langsung di root domain
 */
function validateEpisodeSlug(req, res, next) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({
      success: false,
      message: 'Query parameter "slug" wajib diisi. Contoh: ?slug=soul-land-2-episode-12',
    });
  }

  const clean = slug.replace(/^\/+|\/+$/g, '');
  req.validatedUrl = `${BASE_URL}/${clean}/`;
  req.slug = clean;
  next();
}

module.exports = { validateSeriesSlug, validateEpisodeSlug };
