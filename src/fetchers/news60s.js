// src/fetchers/news60s.js
import { getWithRetry } from '../utils/retry.js';
import { requestWithFallback } from '../utils/apiBase.js';
import { readMock } from '../mock/store.js';
import { getMockNews60s } from '../mock/news60s.js';
import { logSuccess, logFailure } from '../utils/logger.js';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'application/json, text/plain, */*'
};

export async function fetchNews60s(config = {}, options = {}) {
  try {
    return await requestWithFallback(config, 'news60s', async (base) => {
      const res = await getWithRetry(`${base}/v2/60s`, { timeout: 12000, headers: HEADERS }, 1, 1500);
      if (res.data?.code === 200 && res.data.data) {
        const data = res.data.data;
        logSuccess('60s 读世界', data.news?.length || 0);
        return {
          worldNews: data.news || [],
          date: data.date || '',
          tip: data.tip || ''
        };
      }
      throw new Error('API 返回异常');
    });
  } catch (e) {
    logger.error(`[furina-daily] 60s 读世界 API 请求失败: ${e.message}`);
    if (e.code) logger.error(`错误代码: ${e.code}`);
    if (options.useMock === false) throw e;
    const saved = await readMock('news60s');
    if (saved) return saved;
    logFailure('60s 读世界', true);
    return getMockNews60s();
  }
}
