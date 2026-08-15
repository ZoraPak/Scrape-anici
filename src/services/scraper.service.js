const axios   = require('axios');
const cheerio = require('cheerio');
const cache   = require('../utils/cache');
const { withLock } = require('../utils/lock');

const BASE_URL    = 'https://anichin.cafe';
const MAX_RETRIES = 3;   // maks percobaan ulang ke sumber
const RETRY_DELAY = 800; // ms antar retry

// ─── HTTP Client ─────────────────────────────────────────────────────────────

const httpClient = axios.create({
  timeout: 12000,
  headers: {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
  },
});

/**
 * Fetch HTML dengan retry otomatis.
 * Retry hanya pada network error / 5xx; tidak retry 4xx.
 */
async function fetchHtml(url, attempt = 1) {
  try {
    const { data } = await httpClient.get(url);
    return cheerio.load(data);
  } catch (err) {
    const status = err.response?.status;
    const isRetryable = !status || status >= 500; // network error atau 5xx

    if (isRetryable && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY * attempt));
      return fetchHtml(url, attempt + 1);
    }

    const msg = status
      ? `Sumber mengembalikan HTTP ${status}`
      : `Gagal terhubung ke sumber (${err.message})`;
    const error = new Error(msg);
    error.status = status >= 400 && status < 500 ? status : 502;
    throw error;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Ekstrak slug dari URL anichin.cafe.
 * - Series  : https://anichin.cafe/seri/stellar-transformation-season-5/ → stellar-transformation-season-5
 * - Episode : https://anichin.cafe/soul-land-2-episode-12/              → soul-land-2-episode-12
 */
function extractSlug(url) {
  if (!url) return '';
  try {
    const { pathname } = new URL(url);
    const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  } catch {
    return '';
  }
}

function parseAnimeCard($, el) {
  const $el  = $(el);
  const link = $el.find('a').first();
  const img  = $el.find('img').first();
  const href = link.attr('href') || '';
  return {
    title:     link.attr('title') || $el.find('.tt').first().text().trim(),
    slug:      extractSlug(href),
    thumbnail: img.attr('src') || img.attr('data-src') || '',
    episode:   $el.find('.epx').first().text().trim(),
    type:      $el.find('.typez').first().text().trim(),
    status:    $el.find('.status').first().text().trim() || null,
    sub:       $el.find('.sb').first().text().trim(),
  };
}

function parsePagination($) {
  const pages = [];
  $('.pagination .page-numbers').each((_, el) => {
    const $el = $(el);
    pages.push({
      label:   $el.text().trim(),
      url:     $el.attr('href') || null,
      current: $el.hasClass('current'),
    });
  });
  return pages;
}

// ─── Home ─────────────────────────────────────────────────────────────────────

async function getHome() {
  const cacheKey = 'home';
  const cached   = await cache.get(cacheKey);
  if (cached) return cached;

  return withLock(cacheKey, async () => {
    // Double-check cache setelah dapat lock
    const hit = await cache.get(cacheKey);
    if (hit) return hit;

    const $ = await fetchHtml(BASE_URL);

    const slider = [];
    $('#slidertwo .swiper-slide:not(.swiper-slide-duplicate)').each((_, el) => {
      const $el    = $(el);
      const linkEl = $el.find('.info h2 a');
      const href   = linkEl.attr('href') || '';
      slider.push({
        title:       linkEl.text().trim(),
        slug:        extractSlug(href),
        backdrop:    ($el.find('.backdrop').attr('style') || '').replace(/background-image:\s*url\(['"]?|['"]?\)/g, '').trim(),
        description: $el.find('.info p').text().trim(),
      });
    });

    const popularToday = [];
    $('.bixbox.bbnofrm:first-of-type .listupd .bs').each((_, el) => {
      popularToday.push(parseAnimeCard($, el));
    });

    const latestRelease = [];
    $('.releases.latesthome').closest('.bixbox').find('.bs').each((_, el) => {
      latestRelease.push(parseAnimeCard($, el));
    });

    const nextPage = $('.hpage a.r').attr('href') || null;
    const result   = { slider, popularToday, latestRelease, nextPage };

    await cache.set(cacheKey, result, cache.TTL.home);
    return result;
  }, () => cache.get(cacheKey));
}

// ─── Ongoing ─────────────────────────────────────────────────────────────────

async function getOngoing(page = 1) {
  const cacheKey = `ongoing:${page}`;
  const cached   = await cache.get(cacheKey);
  if (cached) return cached;

  return withLock(cacheKey, async () => {
    const hit = await cache.get(cacheKey);
    if (hit) return hit;

    const url = page > 1 ? `${BASE_URL}/ongoing/page/${page}/` : `${BASE_URL}/ongoing/`;
    const $   = await fetchHtml(url);

    const list = [];
    $('.listupd.cp .bs').each((_, el) => list.push(parseAnimeCard($, el)));

    const result = { page: Number(page), list, pagination: parsePagination($) };
    await cache.set(cacheKey, result, cache.TTL.ongoing);
    return result;
  }, () => cache.get(cacheKey));
}

// ─── Completed ────────────────────────────────────────────────────────────────

async function getCompleted(page = 1) {
  const cacheKey = `completed:${page}`;
  const cached   = await cache.get(cacheKey);
  if (cached) return cached;

  return withLock(cacheKey, async () => {
    const hit = await cache.get(cacheKey);
    if (hit) return hit;

    const url = page > 1 ? `${BASE_URL}/completed/page/${page}/` : `${BASE_URL}/completed/`;
    const $   = await fetchHtml(url);

    const list = [];
    $('.listupd.cp .bs').each((_, el) => list.push(parseAnimeCard($, el)));

    const result = { page: Number(page), list, pagination: parsePagination($) };
    await cache.set(cacheKey, result, cache.TTL.completed);
    return result;
  }, () => cache.get(cacheKey));
}

// ─── Schedule ────────────────────────────────────────────────────────────────

async function getSchedule() {
  const cacheKey = 'schedule';
  const cached   = await cache.get(cacheKey);
  if (cached) return cached;

  return withLock(cacheKey, async () => {
    const hit = await cache.get(cacheKey);
    if (hit) return hit;

    const $ = await fetchHtml(`${BASE_URL}/schedule/`);
    const days = {};

    $('.schedulepage').each((_, dayEl) => {
      const $day   = $(dayEl);
      const dayName = $day.find('.releases h3 span').text().trim().toLowerCase();
      const animes  = [];

      $day.find('.bs').each((_, el) => {
        const $el   = $(el);
        const link  = $el.find('a').first();
        const href  = link.attr('href') || '';
        const epEl  = $el.find('.epx');
        animes.push({
          title:       link.attr('title') || $el.find('.tt').text().trim(),
          slug:        extractSlug(href),
          thumbnail:   $el.find('img').attr('src') || '',
          episode:     $el.find('.sb').first().text().trim(),
          releaseTime: epEl.text().trim(),
          countdown:   epEl.attr('data-cndwn') ? Number(epEl.attr('data-cndwn')) : null,
          releaseAt:   epEl.attr('data-rlsdt') ? Number(epEl.attr('data-rlsdt')) : null,
        });
      });

      if (dayName) days[dayName] = animes;
    });

    await cache.set(cacheKey, days, cache.TTL.schedule);
    return days;
  }, () => cache.get(cacheKey));
}

// ─── Detail Series ───────────────────────────────────────────────────────────

async function getDetailSeries(url) {
  const slug     = extractSlug(url);
  const cacheKey = `detail:${slug}`;
  const cached   = await cache.get(cacheKey);
  if (cached) return cached;

  return withLock(cacheKey, async () => {
    const hit = await cache.get(cacheKey);
    if (hit) return hit;

    const $ = await fetchHtml(url);

    const info = {
      title:            $('.entry-title').first().text().trim(),
      thumbnail:        $('.thumb img').first().attr('src') || '',
      cover:            $('.bigcover .ime img').attr('src') || '',
      alternativeTitle: $('.alter').text().trim(),
      synopsis:         $('.bixbox.synp .entry-content').text().trim(),
      rating:           parseFloat($('.numscore').first().text().trim()) || null,
      status: '', network: [], studio: [], released: '',
      duration: '', season: '', country: '', type: '', episodes: '',
      genres: [], tags: [],
    };

    $('.spe span').each((_, el) => {
      const text  = $(el).text();
      const value = $(el).find('a').map((__, a) => $(a).text().trim()).get();
      const plain = text.replace(/^[^:]+:\s*/, '').trim();

      if      (/Status/i.test(text))   info.status   = plain;
      else if (/Network/i.test(text))  info.network  = value.length ? value : [plain];
      else if (/Studio/i.test(text))   info.studio   = value.length ? value : [plain];
      else if (/Released/i.test(text)) info.released = plain;
      else if (/Duration/i.test(text)) info.duration = plain;
      else if (/Season/i.test(text))   info.season   = plain;
      else if (/Country/i.test(text))  info.country  = plain;
      else if (/Type/i.test(text))     info.type     = plain;
      else if (/Episodes/i.test(text)) info.episodes = plain;
    });

    $('.genxed a').each((_, el) => info.genres.push($(el).text().trim()));
    $('.bottom.tags a').each((_, el) => info.tags.push($(el).text().trim()));

    const batchDownload = [];
    $('.soraddlx').each((_, el) => {
      const $el    = $(el);
      const title  = $el.find('.sorattlx h3').text().trim();
      const links  = [];
      $el.find('.soraurlx').each((__, row) => {
        const $row    = $(row);
        const quality = $row.find('strong').text().trim();
        const hosts   = [];
        $row.find('a').each((___, a) => hosts.push({ name: $(a).text().trim(), url: $(a).attr('href') }));
        links.push({ quality, hosts });
      });
      if (title) batchDownload.push({ title, links });
    });

    const episodeList = [];
    $('.eplister ul li').each((_, el) => {
      const $el  = $(el);
      const href = $el.find('a').attr('href') || '';
      episodeList.push({
        episode: $el.find('.epl-num').text().trim(),
        title:   $el.find('.epl-title').text().trim(),
        sub:     $el.find('.epl-sub .status').text().trim(),
        date:    $el.find('.epl-date').text().trim(),
        slug:    extractSlug(href),
      });
    });

    const result = { info, batchDownload, episodeList };
    await cache.set(cacheKey, result, cache.TTL.detail);
    return result;
  }, () => cache.get(cacheKey));
}

// ─── Stream Episode ──────────────────────────────────────────────────────────

async function getStream(url) {
  const slug     = extractSlug(url);
  const cacheKey = `stream:${slug}`;
  const cached   = await cache.get(cacheKey);
  if (cached) return cached;

  return withLock(cacheKey, async () => {
    const hit = await cache.get(cacheKey);
    if (hit) return hit;

    const $ = await fetchHtml(url);

    const title       = $('.entry-title').first().text().trim();
    const thumbnail   = $('.item.meta .tb img').first().attr('src') || '';
    const releasedOn  = $('.year .updated').text().trim();
    const defaultEmbed = $('#pembed iframe').attr('src') || '';

    const servers = [];
    $('select.mirror option').each((_, el) => {
      const $el = $(el);
      const val = $el.attr('value');
      if (!val) return;
      let embedHtml = '';
      try {
        embedHtml = Buffer.from(val, 'base64').toString('utf-8');
      } catch {
        embedHtml = val;
      }
      const srcMatch = embedHtml.match(/src="([^"]+)"/);
      servers.push({
        name:     $el.text().trim(),
        index:    Number($el.attr('data-index')) || 0,
        embedUrl: srcMatch ? srcMatch[1] : '',
      });
    });

    const downloads = [];
    $('.soraddlx .soraurlx').each((_, el) => {
      const $el     = $(el);
      const quality = $el.find('strong').text().trim();
      const hosts   = [];
      $el.find('a').each((__, a) => hosts.push({ name: $(a).text().trim(), url: $(a).attr('href') }));
      downloads.push({ quality, hosts });
    });

    const prevEpHref = $('.naveps.bignav .nvs a[rel="prev"]').attr('href') || null;
    const nextEpHref = (() => {
      const $next = $('.naveps.bignav .nvs').last().find('a');
      return $next.length ? $next.attr('href') : null;
    })();

    const seriesHref = $('.year a').last().attr('href') || '';
    const seriesInfo = {
      name:      $('.year a').last().text().trim(),
      slug:      extractSlug(seriesHref),
      thumbnail: $('.single-info.bixbox .thumb img').attr('src') || '',
      status:    '',
      genres:    [],
    };
    $('.single-info.bixbox .spe span').each((_, el) => {
      const text = $(el).text();
      if (/Status/i.test(text)) seriesInfo.status = text.replace(/^[^:]+:\s*/, '').trim();
    });
    $('.single-info.bixbox .genxed a').each((_, el) => seriesInfo.genres.push($(el).text().trim()));

    const result = {
      title, thumbnail, releasedOn,
      series:      seriesInfo,
      defaultEmbed,
      servers,
      downloads,
      prevEpisode: prevEpHref ? extractSlug(prevEpHref) : null,
      nextEpisode: nextEpHref ? extractSlug(nextEpHref) : null,
    };

    await cache.set(cacheKey, result, cache.TTL.stream);
    return result;
  }, () => cache.get(cacheKey));
}

// ─── Search ──────────────────────────────────────────────────────────────────

async function getSearch(query, page = 1) {
  const cacheKey = `search:${query.toLowerCase()}:${page}`;
  const cached   = await cache.get(cacheKey);
  if (cached) return cached;

  return withLock(cacheKey, async () => {
    const hit = await cache.get(cacheKey);
    if (hit) return hit;

    const url = page > 1
      ? `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query)}`
      : `${BASE_URL}/?s=${encodeURIComponent(query)}`;

    const $ = await fetchHtml(url);

    const list = [];
    $('.listupd .bs').each((_, el) => {
      list.push(parseAnimeCard($, el));
    });

    // Cek apakah ada hasil
    const total = $('.releases h1 span').text().replace(/[^0-9]/g, '') || null;

    const result = {
      query,
      page:       Number(page),
      total:      total ? Number(total) : list.length,
      list,
      pagination: parsePagination($),
    };

    // Cache search lebih singkat — 3 menit
    await cache.set(cacheKey, result, 3 * 60);
    return result;
  }, () => cache.get(cacheKey));
}

// ─── Refresh (internal) ──────────────────────────────────────────────────────

/**
 * Hapus cache untuk resource tertentu.
 * Dipanggil hanya dari endpoint internal.
 *
 * @param {'home'|'ongoing'|'completed'|'schedule'|'detail'|'stream'|'all'} type
 * @param {string} [slug] - wajib untuk type detail/stream
 */
async function refreshCache(type, slug) {
  switch (type) {
    case 'home':      await cache.del('home'); break;
    case 'ongoing':   await cache.delPattern('ongoing:*'); break;
    case 'completed': await cache.delPattern('completed:*'); break;
    case 'schedule':  await cache.del('schedule'); break;
    case 'detail':    await cache.del(`detail:${slug}`); break;
    case 'stream':    await cache.del(`stream:${slug}`); break;
    case 'search':    await cache.delPattern('search:*'); break;
    case 'all':
      await Promise.all([
        cache.del('home'),
        cache.del('schedule'),
        cache.delPattern('ongoing:*'),
        cache.delPattern('completed:*'),
        cache.delPattern('detail:*'),
        cache.delPattern('stream:*'),
        cache.delPattern('search:*'),
      ]);
      break;
    default:
      throw Object.assign(new Error(`Tipe refresh tidak dikenal: ${type}`), { status: 400 });
  }
}

module.exports = {
  getHome, getOngoing, getCompleted, getSchedule,
  getDetailSeries, getStream, getSearch, refreshCache,
};
