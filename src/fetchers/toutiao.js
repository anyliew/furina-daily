// plugins/furina-daily/src/fetchers/toutiao.js
import axios from 'axios';
import { getMockToutiao } from '../mock/toutiao.js';
import { logSuccess, logFailure } from '../utils/logger.js';

export async function fetchToutiao(config = {}) {
  const base = config.apiBase?.viki || 'https://60s.viki.moe';
  try {
    const res = await axios.get(`${base}/v2/toutiao`, { timeout: 10000 });
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
    if (e.response) {
      logger.error(`状态码: ${e.response.status}`);
      logger.error(`响应体: ${JSON.stringify(e.response.data)}`);
    }
    logFailure('头条热搜', true);
    return getMockToutiao();
  }
}

function formatHotValue(value) {
  if (!value) return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return value.toString();
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w';
  }
  return num.toString();
}