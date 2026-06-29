// src/fetchers/itNews.js
import { getWithRetry } from '../utils/retry.js';
import { getMockITNews } from '../mock/itNews.js';
import { logSuccess, logFailure } from '../utils/logger.js';

export async function fetchITNews(config = {}) {
  const base = config.apiBase?.viki || 'https://60s.viki.moe';
  const url = `${base}/v2/it-news/rank`;
  const requestConfig = {
    timeout: 15000,
    params: {
      type: 'day',
      limit: 10
    },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'application/json, text/plain, */*'
    }
  };

  try {
    const res = await getWithRetry(url, requestConfig, 3, 3000);
    if (res.data?.code === 200 && res.data.data) {
      const titles = res.data.data.slice(0, 10).map(item => item.title);
      logSuccess('IT之家热门榜单', titles.length);
      return titles;
    }
    throw new Error('API 返回异常');
  } catch (e) {
    logger.error(`[furina-daily] IT之家热门榜单 API 请求失败: ${e.message}`);
    if (e.code) logger.error(`错误代码: ${e.code}`);
    logFailure('IT之家热门榜单', true);
    return getMockITNews();
  }
}