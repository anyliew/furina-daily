// plugins/furina-daily/src/fetchers/news60s.js
import axios from 'axios';
import { getMockNews60s } from '../mock/news60s.js';
import { logSuccess, logFailure } from '../utils/logger.js';

export async function fetchNews60s(config = {}) {
  const base = config.apiBase?.viki || 'https://60s.viki.moe';
  try {
    const res = await axios.get(`${base}/v2/60s`, { timeout: 10000 });
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
    if (e.response) {
      logger.error(`状态码: ${e.response.status}`);
      logger.error(`响应体: ${JSON.stringify(e.response.data)}`);
    }
    logFailure('60s 读世界', true);
    return getMockNews60s();
  }
}