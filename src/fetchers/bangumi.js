// plugins/furina-daily/src/fetchers/bangumi.js (支持自定义 API 地址)
const WEEKDAY_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const EPISODE_LIMIT = 100;
const EPISODE_CONCURRENCY = 4;
const MAX_EPISODE_PAGES = 5;

function getBangumiApiBase(config = {}) {
  return config.apiBase?.bangumi || 'https://api.bgm.tv';
}

export async function getTodayBangumi(config = {}) {
  const base = getBangumiApiBase(config);
  const calendar = await fetchCalendar(base);
  const day = pickCalendarDay(calendar, new Date());
  if (!day) {
    throw new Error('没有找到今天的番剧日历数据');
  }
  const data = normalizeCalendarDay(day, new Date());
  data.items = await enrichItemsWithEpisodeInfo(data.items, base);
  return data;
}

async function fetchCalendar(base) {
  const url = `${base}/calendar`;
  const data = await fetchJson(url);
  const list = Array.isArray(data) ? data : Array.isArray(data?.value) ? data.value : [];
  if (!list.length) {
    throw new Error('Bangumi API 返回数据为空');
  }
  return list;
}

async function fetchJson(url, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let response;
  try {
    response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'bangumi-calendar-plugin/1.0 (https://github.com/bangumi/api)'
      },
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Bangumi API 请求超时');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new Error(`Bangumi API 请求失败：${response.status}`);
  }
  return await response.json();
}

function pickCalendarDay(calendar, date = new Date()) {
  const weekdayId = getBangumiWeekdayId(date);
  return calendar.find((day) => Number(day?.weekday?.id) === weekdayId);
}

function getBangumiWeekdayId(date = new Date()) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function normalizeCalendarDay(day, date = new Date()) {
  const weekday = day?.weekday || {};
  const items = Array.isArray(day?.items) ? day.items.map(normalizeItem) : [];
  const bgImage = items.find((item) => item.image)?.image || '';
  return {
    weekday,
    weekdayText: weekday.cn || WEEKDAY_CN[date.getDay()],
    dateText: formatDate(date),
    generatedAt: formatTime(new Date()),
    total: items.length,
    items,
    bgImage
  };
}

function normalizeItem(item) {
  const displayName = item?.name_cn || item?.name || '未命名番剧';
  const subName = item?.name_cn && item?.name && item.name_cn !== item.name ? item.name : '';
  const score = Number(item?.rating?.score || 0);
  const rank = Number(item?.rank || 0);
  const doing = Number(item?.collection?.doing || 0);
  return {
    id: item?.id,
    displayName,
    subName,
    image: normalizeImage(item?.images),
    scoreText: score > 0 ? score.toFixed(1) : '暂无',
    rankText: rank > 0 ? `Rank ${rank}` : '',
    doingText: formatNumber(doing),
    airDate: item?.air_date || '未知',
    episodeText: '',
    url: toHttps(item?.url || '')
  };
}

async function enrichItemsWithEpisodeInfo(items, base) {
  return await mapLimit(items, EPISODE_CONCURRENCY, async (item) => {
    try {
      const episodeText = await getTodayEpisodeText(item.id, base);
      return { ...item, episodeText };
    } catch (error) {
      globalThis.logger?.debug?.(`[bangumi-calendar-plugin] 获取剧集话数失败：${item.id}`);
      globalThis.logger?.debug?.(error);
      return item;
    }
  });
}

async function getTodayEpisodeText(subjectId, base) {
  if (!subjectId) return '';
  const firstPage = await fetchEpisodesPage(subjectId, 0, base);
  const total = Number(firstPage?.total || 0);
  const firstMatch = pickTodayEpisode(firstPage?.data);
  if (firstMatch) return formatEpisodeText(firstMatch);
  if (total <= EPISODE_LIMIT) return '';

  let offset = Math.floor((total - 1) / EPISODE_LIMIT) * EPISODE_LIMIT;
  let pageCount = 0;
  while (offset > 0 && pageCount < MAX_EPISODE_PAGES) {
    const page = await fetchEpisodesPage(subjectId, offset, base);
    const match = pickTodayEpisode(page?.data);
    if (match) return formatEpisodeText(match);
    offset = Math.max(0, offset - EPISODE_LIMIT);
    pageCount += 1;
  }
  return '';
}

async function fetchEpisodesPage(subjectId, offset, base) {
  const url = `${base}/v0/episodes?subject_id=${encodeURIComponent(subjectId)}&type=0&limit=${EPISODE_LIMIT}&offset=${offset}`;
  return await fetchJson(url, 12000);
}

function pickTodayEpisode(episodes, date = new Date()) {
  if (!Array.isArray(episodes)) return null;
  const todayKey = toDateKey(date);
  return episodes
    .map((episode) => ({
      episodeNo: Number(episode?.ep || episode?.sort || 0),
      airdateKey: normalizeAirdateKey(episode?.airdate)
    }))
    .filter((episode) => episode.episodeNo > 0 && episode.airdateKey === todayKey)
    .sort((a, b) => b.episodeNo - a.episodeNo)[0];
}

function formatEpisodeText(episode) {
  return `第 ${formatEpisodeNo(episode.episodeNo)} 话`;
}

function normalizeAirdateKey(value) {
  if (typeof value !== 'string') return '';
  const match = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return '';
  const [, year, month, day] = match;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatEpisodeNo(value) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.0$/, '');
}

function pad(value) {
  return String(value).padStart(2, '0');
}

async function mapLimit(list, limit, handler) {
  const results = new Array(list.length);
  let index = 0;
  async function worker() {
    while (index < list.length) {
      const current = index;
      index += 1;
      results[current] = await handler(list[current], current);
    }
  }
  const workers = Array.from({ length: Math.min(limit, list.length) }, worker);
  await Promise.all(workers);
  return results;
}

function normalizeImage(images) {
  if (!images) return '';
  return toHttps(images.large || images.common || images.medium || images.grid || images.small || '');
}

function toHttps(url) {
  return typeof url === 'string' ? url.replace(/^http:\/\//, 'https://') : '';
}

function formatDate(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long'
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

function formatNumber(num) {
  if (!Number.isFinite(num) || num <= 0) return '0';
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`;
  return String(num);
}