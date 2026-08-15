const service = require('../services/scraper.service');

async function home(req, res, next) {
  try {
    const data = await service.getHome(req.query.page || 1);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function ongoing(req, res, next) {
  try {
    const data = await service.getOngoing(req.query.page || 1);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function completed(req, res, next) {
  try {
    const data = await service.getCompleted(req.query.page || 1);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function schedule(req, res, next) {
  try {
    const data = await service.getSchedule();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function detail(req, res, next) {
  try {
    const data = await service.getDetailSeries(req.validatedUrl);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function stream(req, res, next) {
  try {
    const data = await service.getStream(req.validatedUrl);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function search(req, res, next) {
  try {
    const { q, page } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ success: false, message: 'Query parameter "q" wajib diisi.' });
    }
    const data = await service.getSearch(q.trim(), page || 1);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}


// POST /internal/refresh
// Body: { type: 'home'|'ongoing'|'completed'|'schedule'|'detail'|'stream'|'all', slug?: string }
async function refresh(req, res, next) {
  try {
    const { type, slug } = req.body;
    if (!type) {
      return res.status(400).json({ success: false, message: 'Field "type" wajib diisi.' });
    }
    await service.refreshCache(type, slug);
    res.json({ success: true, message: `Cache "${type}" berhasil dihapus.` });
  } catch (err) { next(err); }
}

module.exports = { home, ongoing, completed, schedule, detail, stream, search, refresh };
