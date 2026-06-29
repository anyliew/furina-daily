// src/fetchers/news60s.js
import { getWithRetry } from '../utils/retry.js';
import { getMockNews60s } from '../mock/news60s.js';
import { logSuccess, logFailure } from '../utils/logger.js';

export async function fetchNews60s(config = {}) {
  const base = config.apiBase?.viki || 'https://60s.viki.moe';
  const url = `${base}/v2/60s`;
  const requestConfig = {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'application/json, text/plain, */*'
    }
  };

  try {
    const res = await getWithRetry(url, requestConfig, 3, 3000);
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
  } catch (e) {
    logger.error(`[furina-daily] 60s 读世界 API 请求失败: ${e.message}`);
    if (e.code) logger.error(`错误代码: ${e.code}`);
    logFailure('60s 读世界', true);
    return getMockNews60s();
  }
}