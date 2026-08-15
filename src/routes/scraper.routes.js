const { Router }    = require('express');
const controller    = require('../controllers/scraper.controller');
const { validateSeriesSlug, validateEpisodeSlug } = require('../middlewares/validateUrl');
const { strict }    = require('../middlewares/rateLimiter');
const internalOnly  = require('../middlewares/internalOnly');

const router = Router();

// ─── Public endpoints ────────────────────────────────────────────────────────

// GET /api/home
router.get('/home', controller.home);

// GET /api/ongoing?page=1
router.get('/ongoing', controller.ongoing);

// GET /api/completed?page=1
router.get('/completed', controller.completed);

// GET /api/schedule
router.get('/schedule', controller.schedule);

// GET /api/detail?slug=stellar-transformation-season-5
// strict limiter karena scraping berat
router.get('/detail', strict, validateSeriesSlug, controller.detail);

// GET /api/stream?slug=soul-land-2-episode-12
// strict limiter karena scraping + decode base64
router.get('/stream', strict, validateEpisodeSlug, controller.stream);

// ─── Internal endpoints ──────────────────────────────────────────────────────

// POST /api/internal/refresh
// Hanya bisa dipanggil dari localhost dengan header X-Internal-Secret
router.post('/internal/refresh', internalOnly, controller.refresh);

module.exports = router;
