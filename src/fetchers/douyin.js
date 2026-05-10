// plugins/furina-daily/src/fetchers/douyin.js
import axios from 'axios';
import { getMockDouyinHot } from '../mock/douyin.js';
import { formatHotValue } from '../utils/format.js';
import { logSuccess, logFailure } from '../utils/logger.js';

export async function fetchDouyinHot(config = {}) {
  const base = config.apiBase?.viki || 'https://60s.viki.moe';
  try {
    const res = await axios.get(`${base}/v2/douyin`, { timeout: 10000 });
    if (res.data?.code === 200 && res.data.data) {
      const list = res.data.data.slice(0, 10).map((item, index) => ({
        title: item.title || '未知标题',
        hot_value: item.hot_value,
        cover: item.cover || '',
        rank: index + 1,
        hotDisplay: formatHotValue(item.hot_value)
      }));
      logSuccess('抖音热搜', list.length);
      return list;
    }
    throw new Error('API 返回异常');
  } catch (e) {
    logger.error(`[furina-daily] 抖音热搜 API 请求失败: ${e.message}`);
    if (e.response) {
      logger.error(`状态码: ${e.response.status}`);
      logger.error(`响应体: ${JSON.stringify(e.response.data)}`);
    }
    logFailure('抖音热搜', true);
    return getMockDouyinHot();
  }
}