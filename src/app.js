const express      = require('express');
const scraperRoutes = require('./routes/scraper.routes');
const { general }  = require('./middlewares/rateLimiter');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Trust proxy (wajib kalau di belakang Nginx/Cloudflare agar req.ip benar)
app.set('trust proxy', 1);

// Parse JSON body
app.use(express.json());

// Rate limit umum — berlaku untuk semua endpoint
app.use(general);

// Root info
app.get('/', (req, res) => {
  res.json({
    name: 'Anichin Scraper API',
    version: '1.0.0',
    endpoints: {
      home:           'GET  /api/home',
      ongoing:        'GET  /api/ongoing?page=1',
      completed:      'GET  /api/completed?page=1',
      schedule:       'GET  /api/schedule',
      detail_series:  'GET  /api/detail?slug=stellar-transformation-season-5',
      stream_episode: 'GET  /api/stream?slug=soul-land-2-episode-12',
      refresh_cache:  'POST /api/internal/refresh  [internal only]',
    },
  });
});

// Scraper routes
app.use('/api', scraperRoutes);

// Global error handler (harus paling akhir)
app.use(errorHandler);

module.exports = app;
