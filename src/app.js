const express       = require('express');
const cors          = require('cors');
const scraperRoutes = require('./routes/scraper.routes');
const { general }   = require('./middlewares/rateLimiter');
const errorHandler  = require('./middlewares/errorHandler');

const app = express();

// Trust proxy
app.set('trust proxy', 1);

// CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://animesaga.online',
  'https://www.animesaga.online',
];

app.use(cors({
  origin: (origin, callback) => {
    // Izinkan request tanpa origin (Postman, server-to-server, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} tidak diizinkan`));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-Internal-Secret'],
  credentials: true,
}));

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
      search:         'GET  /api/search?q=soul+land&page=1',
      refresh_cache:  'POST /api/internal/refresh  [internal only]',
    },
  });
});

// Scraper routes
app.use('/api', scraperRoutes);

// Global error handler (harus paling akhir)
app.use(errorHandler);

module.exports = app;
