// plugins/furina-daily/src/fetchers/itNews.js
import axios from 'axios';
import { getMockITNews } from '../mock/itNews.js';
import { logSuccess, logFailure } from '../utils/logger.js';

export async function fetchITNews(config = {}) {
  const base = config.apiBase?.viki || 'https://60s.viki.moe';
  try {
    // 修改点：使用新接口 /v2/it-news/rank，并添加 type=day 和 limit=10 参数
    const res = await axios.get(`${base}/v2/it-news/rank`, {
      params: {
        type: 'day',
        limit: 10
      },
      timeout: 10000
    });
    if (res.data?.code === 200 && res.data.data) {
      // 修改点：新接口返回的 data 中每项包含 title 和 link
      // 直接提取 title 数组，保持与原有模板兼容
      const titles = res.data.data.slice(0, 10).map(item => item.title);
      logSuccess('IT之家热门榜单', titles.length);
      return titles;
    }
    throw new Error('API 返回异常');
  } catch (e) {
    logger.error(`[furina-daily] IT之家热门榜单 API 请求失败: ${e.message}`);
    if (e.response) {
      logger.error(`状态码: ${e.response.status}`);
      logger.error(`响应体: ${JSON.stringify(e.response.data)}`);
    }
    logFailure('IT之家热门榜单', true);
    return getMockITNews();
  }
}