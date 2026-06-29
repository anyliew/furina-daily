// src/fetchers/toutiao.js
import { getWithRetry } from '../utils/retry.js';
import { logSuccess, logFailure } from '../utils/logger.js';
import { getMockToutiao } from '../mock/toutiao.js';

function formatHotValue(value) {
  if (!value) return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return value.toString();
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w';
  }
  return num.toString();
}

export async function fetchToutiao(config = {}) {
  const base = config.apiBase?.viki || 'https://60s.viki.moe';
  const url = `${base}/v2/toutiao`;
  const requestConfig = {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'application/json, text/plain, */*'
    }
  };

  try {
    const res = await getWithRetry(url, requestConfig, 3, 30000);
    if (res.data?.code === 200 && Array.isArray(res.data.data)) {
      const list = res.data.data.slice(0, 10).map((item, index) => ({
        title: item.title,
        hotValue: item.hot_value || 0,
        hotDisplay: formatHotValue(item.hot_value),
        cover: item.cover || '',
        link: item.link || '',
        rank: index + 1,
      }));
      logSuccess('头条热搜', list.length);
      return list;
    }
    throw new Error('API 返回异常');
  } catch (e) {
    logger.error(`[furina-daily] 头条热搜 API 请求失败: ${e.message}`);
    if (e.code) logger.error(`错误代码: ${e.code}`);
    logFailure('头条热搜', true);
    return getMockToutiao();
  }
}