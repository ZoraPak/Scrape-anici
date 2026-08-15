# Anichin Scraper API — Dokumentasi Lengkap

## Daftar Isi

1. [Struktur Project](#1-struktur-project)
2. [Cara Menjalankan Lokal](#2-cara-menjalankan-lokal)
3. [Environment Variables](#3-environment-variables)
4. [Endpoint API](#4-endpoint-api)
5. [Rate Limiting](#5-rate-limiting)
6. [Cache & Redis](#6-cache--redis)
7. [Endpoint Internal (Refresh Cache)](#7-endpoint-internal-refresh-cache)
8. [Deploy ke Railway](#8-deploy-ke-railway)
9. [Arsitektur & Alur Request](#9-arsitektur--alur-request)

---

## 1. Struktur Project

```
scraper-api/
├── src/
│   ├── config/
│   │   └── redis.js            # Koneksi Redis (support REDIS_URL & host/port)
│   ├── utils/
│   │   ├── cache.js            # Helper get/set/del cache
│   │   └── lock.js             # Distributed lock per slug
│   ├── middlewares/
│   │   ├── rateLimiter.js      # Rate limit: general / strict / search
│   │   ├── internalOnly.js     # Proteksi endpoint internal
│   │   ├── validateUrl.js      # Validasi & konversi slug → URL
│   │   └── errorHandler.js     # Global error handler
│   ├── services/
│   │   └── scraper.service.js  # Logic scraping + cache + lock + retry
│   ├── controllers/
│   │   └── scraper.controller.js
│   ├── routes/
│   │   └── scraper.routes.js
│   ├── app.js
│   └── index.js
├── .env                        # Environment variables (jangan di-commit)
├── .env.example                # Template env untuk tim
├── .gitignore
├── package.json
└── railway.json                # Konfigurasi deploy Railway
```

---

## 2. Cara Menjalankan Lokal

### Prasyarat

- Node.js >= 18
- Redis (opsional — API tetap jalan tanpa Redis, hanya tanpa cache)

### Install & Jalankan

```bash
# Clone / masuk ke folder
cd scraper-api

# Install dependencies
npm install

# Salin file env
cp .env.example .env
# Edit .env sesuai kebutuhan

# Jalankan development (auto-reload)
npm run dev

# Atau production
npm start
```

Server berjalan di `http://localhost:3000`

### Menjalankan Redis Lokal (opsional)

Jika belum install Redis:

**Windows (via WSL / Memurai):**
```bash
# WSL
sudo apt install redis-server
redis-server

# Atau pakai Memurai (GUI): https://www.memurai.com/
```

**Docker:**
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

---

## 3. Environment Variables

| Variabel | Wajib | Default | Keterangan |
|---|---|---|---|
| `PORT` | Ya | `3000` | Port server. Railway isi otomatis. |
| `REDIS_URL` | Tidak | — | URL lengkap Redis. Railway isi otomatis saat plugin ditambahkan. Prioritas lebih tinggi dari host/port. |
| `REDIS_HOST` | Tidak | `127.0.0.1` | Host Redis (digunakan jika REDIS_URL kosong) |
| `REDIS_PORT` | Tidak | `6379` | Port Redis |
| `REDIS_PASSWORD` | Tidak | — | Password Redis |
| `REDIS_DB` | Tidak | `0` | Nomor database Redis |
| `INTERNAL_SECRET` | Ya* | — | Secret header untuk endpoint refresh cache. Jika tidak diset, endpoint `/api/internal/refresh` akan selalu mengembalikan 503. |

> *`INTERNAL_SECRET` wajib diset jika ingin menggunakan endpoint refresh.

---

## 4. Endpoint API

Base URL lokal: `http://localhost:3000`
Base URL production: `https://<nama-project>.up.railway.app`

### GET `/api/home`

Mengambil konten halaman utama: slider, popular today, latest release.

**Response:**
```json
{
  "success": true,
  "data": {
    "slider": [
      {
        "title": "Stellar Transformation Season 5",
        "slug": "stellar-transformation-season-5",
        "backdrop": "https://...",
        "description": "..."
      }
    ],
    "popularToday": [ ... ],
    "latestRelease": [ ... ],
    "nextPage": "https://anichin.cafe/page/2/"
  }
}
```

---

### GET `/api/ongoing?page=1`

Daftar series ongoing. Parameter `page` opsional (default: 1).

**Response:**
```json
{
  "success": true,
  "data": {
    "page": 1,
    "list": [
      {
        "title": "Soul Land 2",
        "slug": "soul-land-2-the-unrivaled-tang-sect",
        "thumbnail": "https://...",
        "episode": "Ep 166",
        "type": "Donghua",
        "status": "Ongoing",
        "sub": "Sub Indo"
      }
    ],
    "pagination": [
      { "label": "1", "url": null, "current": true },
      { "label": "2", "url": "https://anichin.cafe/ongoing/page/2/", "current": false }
    ]
  }
}
```

---

### GET `/api/completed?page=1`

Daftar series completed. Sama persis strukturnya dengan `/api/ongoing`.

---

### GET `/api/schedule`

Jadwal rilis per hari dalam seminggu.

**Response:**
```json
{
  "success": true,
  "data": {
    "senin": [
      {
        "title": "...",
        "slug": "...",
        "thumbnail": "https://...",
        "episode": "Ep 12",
        "releaseTime": "19:00 WIB",
        "countdown": 3600,
        "releaseAt": 1700000000
      }
    ],
    "selasa": [ ... ],
    "rabu": [ ... ]
  }
}
```

---

### GET `/api/detail?slug={series-slug}`

Detail lengkap satu series: info, batch download, daftar episode.

**Parameter:**
| Param | Wajib | Contoh |
|---|---|---|
| `slug` | Ya | `soul-land-2-the-unrivaled-tang-sect` |

**Response:**
```json
{
  "success": true,
  "data": {
    "info": {
      "title": "Soul Land 2: The Unrivaled Tang Sect",
      "thumbnail": "https://...",
      "cover": "https://...",
      "alternativeTitle": "斗罗大陆2",
      "synopsis": "...",
      "rating": 8.5,
      "status": "Ongoing",
      "network": ["Tencent Video"],
      "studio": ["Sparkly Key Animation Studio"],
      "released": "2021",
      "duration": "15 menit",
      "season": "Spring 2021",
      "country": "China",
      "type": "Donghua",
      "episodes": "Unknown",
      "genres": ["Action", "Fantasy"],
      "tags": ["Donghua", "Sub Indo"]
    },
    "batchDownload": [
      {
        "title": "Batch Episode 1-50",
        "links": [
          {
            "quality": "720p",
            "hosts": [
              { "name": "GDrive", "url": "https://..." }
            ]
          }
        ]
      }
    ],
    "episodeList": [
      {
        "episode": "166",
        "title": "Episode 166",
        "sub": "Sub Indo",
        "date": "2024-01-01",
        "slug": "soul-land-2-the-unrivaled-tang-sect-episode-166"
      }
    ]
  }
}
```

---

### GET `/api/stream?slug={episode-slug}`

Data streaming satu episode: server video, download links, navigasi episode.

**Parameter:**
| Param | Wajib | Contoh |
|---|---|---|
| `slug` | Ya | `soul-land-2-the-unrivaled-tang-sect-episode-166` |

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "Soul Land 2: The Unrivaled Tang Sect",
    "thumbnail": "https://...",
    "releasedOn": "2024-01-01",
    "series": {
      "name": "Soul Land 2: The Unrivaled Tang Sect",
      "slug": "soul-land-2-the-unrivaled-tang-sect",
      "thumbnail": "https://...",
      "status": "Ongoing",
      "genres": ["Action", "Fantasy"]
    },
    "defaultEmbed": "https://anichin.stream/?id=v7bz8as",
    "servers": [
      { "name": "Premium",          "index": 1, "embedUrl": "https://anichin.stream/?id=v7bz8as" },
      { "name": "OK.ru",            "index": 2, "embedUrl": "https://ok.ru/videoembed/154853033274" },
      { "name": "Dailymotion [Ads]","index": 3, "embedUrl": "https://anichin.stream/?id=v7bz8as" },
      { "name": "Rumble [Ads]",     "index": 4, "embedUrl": "https://rumble.com/embed/v7bz8as" },
      { "name": "Drive 1 [Ads]",    "index": 5, "embedUrl": "https://player.abyssplayer.com/p-Ukjv0um" },
      { "name": "Drive 2 [Ads]",    "index": 6, "embedUrl": "https://rubyvidhub.com/embed-gbk2g8tlnjbg.html" }
    ],
    "downloads": [
      {
        "quality": "360p",
        "hosts": [{ "name": "Mirrored", "url": "https://..." }]
      },
      { "quality": "480p",  "hosts": [ ... ] },
      { "quality": "720p",  "hosts": [ ... ] },
      { "quality": "1080p", "hosts": [ ... ] },
      { "quality": "4K",    "hosts": [ ... ] }
    ],
    "prevEpisode": "soul-land-2-the-unrivaled-tang-sect-episode-165",
    "nextEpisode": null
  }
}
```

---

### Error Response

Semua endpoint mengembalikan format yang konsisten saat error:

```json
{
  "success": false,
  "message": "Pesan error yang deskriptif"
}
```

| HTTP Status | Keterangan |
|---|---|
| `400` | Parameter tidak valid / slug tidak diberikan |
| `403` | Akses ditolak (endpoint internal) |
| `429` | Rate limit tercapai — lihat header `Retry-After` |
| `502` | Gagal fetch dari sumber (anichin.cafe) |
| `503` | INTERNAL_SECRET belum dikonfigurasi |

---

## 5. Rate Limiting

| Limiter | Berlaku Pada | Batas |
|---|---|---|
| `general` | Semua endpoint | 60 request / menit / IP |
| `strict` | `/api/detail`, `/api/stream` | 20 request / menit / IP |

Saat batas tercapai, response:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "success": false,
  "message": "Terlalu banyak request. Coba lagi dalam 60 detik.",
  "retryAfter": 60
}
```

---

## 6. Cache & Redis

### TTL per Resource

| Resource | TTL |
|---|---|
| Home | 5 menit |
| Ongoing | 10 menit |
| Completed | 30 menit |
| Schedule | 1 jam |
| Detail series | 15 menit |
| Stream episode | 10 menit |

### Graceful Degrade

Jika Redis tidak tersedia, API tetap berjalan normal — setiap request akan melakukan scraping langsung. Tidak ada crash.

### Distributed Lock

Saat 100 request bersamaan meminta slug yang sama:
- Request pertama dapat lock → scraping dijalankan
- 99 request lainnya menunggu (polling setiap 100ms, max 29 detik)
- Setelah lock lepas → semua baca dari cache
- Hanya 1 scraping yang terjadi

---

## 7. Endpoint Internal (Refresh Cache)

### POST `/api/internal/refresh`

Menghapus cache untuk resource tertentu tanpa restart server.

**Proteksi:**
- Hanya bisa dipanggil dari IP `127.0.0.1` / `::1` (localhost)
- Wajib sertakan header `X-Internal-Secret` yang cocok dengan env `INTERNAL_SECRET`

**Request:**
```http
POST /api/internal/refresh
X-Internal-Secret: b1773b7e85d8745696223e9aa3a425452db1c481
Content-Type: application/json

{
  "type": "detail",
  "slug": "soul-land-2-the-unrivaled-tang-sect"
}
```

**Field `type`:**

| Value | Efek |
|---|---|
| `home` | Hapus cache home |
| `ongoing` | Hapus semua cache ongoing (semua page) |
| `completed` | Hapus semua cache completed |
| `schedule` | Hapus cache schedule |
| `detail` | Hapus cache detail satu series (butuh `slug`) |
| `stream` | Hapus cache stream satu episode (butuh `slug`) |
| `all` | Hapus semua cache |

**Response:**
```json
{
  "success": true,
  "message": "Cache \"detail\" berhasil dihapus."
}
```

---

## 8. Deploy ke Railway

### Langkah 1 — Inisialisasi Git

```bash
cd scraper-api
git init
git add .
git commit -m "init: anichin scraper api"
```

> Pastikan `.env` ada di `.gitignore` — sudah otomatis terkecualikan.

### Langkah 2 — Push ke GitHub

```bash
git remote add origin https://github.com/username/anichin-scraper-api.git
git push -u origin main
```

### Langkah 3 — Buat Project di Railway

1. Buka [railway.app](https://railway.app) dan login
2. Klik **New Project**
3. Pilih **Deploy from GitHub repo**
4. Pilih repository `anichin-scraper-api`
5. Railway otomatis detect `railway.json` dan mulai build

### Langkah 4 — Tambah Redis

1. Di dashboard project, klik **+ Add Service**
2. Pilih **Database → Redis**
3. Railway otomatis meng-inject variabel `REDIS_URL` ke service API kamu

### Langkah 5 — Set Environment Variables

Di Railway → pilih service API → tab **Variables** → klik **+ New Variable**:

| Key | Value |
|---|---|
| `INTERNAL_SECRET` | String random (contoh: generate dengan `openssl rand -hex 32`) |

> `PORT` dan `REDIS_URL` **tidak perlu diset manual** — Railway mengisinya otomatis.

### Langkah 6 — Akses API

Setelah deploy selesai, Railway memberi domain:

```
https://<nama-project>.up.railway.app
```

Test:
```bash
curl https://<nama-project>.up.railway.app/api/home
```

### Menghasilkan INTERNAL_SECRET yang aman

```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
```

---

## 9. Arsitektur & Alur Request

```
Client
  │
  ▼
[Rate Limiter: general 60/min]
  │
  ▼
[Route Handler]
  │
  ├── /detail, /stream → [Rate Limiter: strict 20/min]
  │                    → [Validate Slug → URL]
  │
  ├── /internal/*      → [internalOnly: IP + Secret]
  │
  ▼
[Controller]
  │
  ▼
[Service]
  │
  ├── 1. Cek cache Redis
  │       └── HIT → return data (tidak scraping)
  │
  ├── 2. Acquire distributed lock
  │       └── Dapat lock:
  │             ├── Double-check cache (mungkin sudah diisi proses lain)
  │             ├── Fetch HTML dari anichin.cafe (retry 3x jika gagal)
  │             ├── Parse dengan Cheerio
  │             ├── Set cache Redis dengan TTL
  │             └── Release lock → return data
  │
  │       └── Tidak dapat lock (proses lain sedang scraping):
  │             ├── Polling tunggu lock lepas (max 29 detik)
  │             └── Baca cache → return data
  │
  ▼
[Error Handler]
  └── Format error → JSON { success: false, message }
```
