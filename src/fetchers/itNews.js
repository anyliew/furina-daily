// src/fetchers/itNews.js
import { getWithRetry } from '../utils/retry.js';
import { requestWithFallback } from '../utils/apiBase.js';
import { readMock } from '../mock/store.js';
import { getMockITNews } from '../mock/itNews.js';
import { logSuccess, logFailure } from '../utils/logger.js';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'application/json, text/plain, */*'
};

export async function fetchITNews(config = {}, options = {}) {
  try {
    return await requestWithFallback(config, 'itNews', async (base) => {
      const res = await getWithRetry(`${base}/v2/it-news/rank`, {
        timeout: 12000,
        params: { type: 'day', limit: 10 },
        headers: HEADERS
      }, 1, 1500);
      if (res.data?.code === 200 && res.data.data) {
        const titles = res.data.data.slice(0, 10).map(item => item.title);
        logSuccess('IT之家热门榜单', titles.length);
        return titles;
      }
      throw new Error('API 返回异常');
    });
  } catch (e) {
    logger.error(`[furina-daily] IT之家热门榜单 API 请求失败: ${e.message}`);
    if (e.code) logger.error(`错误代码: ${e.code}`);
    if (options.useMock === false) throw e;
    const saved = await readMock('itNews');
    if (saved) return saved;
    logFailure('IT之家热门榜单', true);
    return getMockITNews();
  }
}
