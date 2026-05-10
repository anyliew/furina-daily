// plugins/furina-daily/src/fetchers/bilibili.js
import axios from 'axios';
import { getMockBilibiliHot } from '../mock/bilibili.js';
import { logSuccess, logFailure } from '../utils/logger.js';

export async function fetchBilibiliHot(config = {}) {
  const base = config.apiBase?.viki || 'https://60s.viki.moe';
  try {
    const res = await axios.get(`${base}/v2/bili`, { timeout: 10000 });
    if (res.data?.code === 200 && res.data.data) {
      const list = res.data.data.slice(0, 10).map((item, index) => ({
        title: item.title,
        hot: true,
        rank: index + 1
      }));
      logSuccess('B站热点', list.length);
      return list;
    }
    throw new Error('API 返回异常');
  } catch (e) {
    logger.error(`[furina-daily] B站热点 API 请求失败: ${e.message}`);
    if (e.response) {
      logger.error(`状态码: ${e.response.status}`);
      logger.error(`响应体: ${JSON.stringify(e.response.data)}`);
    }
    logFailure('B站热点', true);
    return getMockBilibiliHot();
  }
}