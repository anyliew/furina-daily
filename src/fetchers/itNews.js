import axios from 'axios';
import { getMockITNews } from '../mock/itNews.js';
import { logSuccess, logFailure } from '../utils/logger.js';

export async function fetchITNews() {
  try {
    const res = await axios.get('https://60s.viki.moe/v2/it-news', { timeout: 10000 });
    if (res.data?.code === 200 && res.data.data) {
      const titles = res.data.data.slice(0, 8).map(item => item.title);
      logSuccess('IT资讯', titles.length);
      return titles;
    }
    throw new Error('API 返回异常');
  } catch (e) {
    logger.error(`[furina-daily] IT资讯 API 请求失败: ${e.message}`);
    if (e.response) {
      logger.error(`状态码: ${e.response.status}`);
      logger.error(`响应体: ${JSON.stringify(e.response.data)}`);
    }
    logFailure('IT资讯', true);
    return getMockITNews();
  }
}