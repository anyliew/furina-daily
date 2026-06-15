// plugins/furina-daily/src/fetchers/zhihu.js
import axios from 'axios';
import { getMockZhihu } from '../mock/zhihu.js';
import { logSuccess, logFailure } from '../utils/logger.js';

export async function fetchZhihu(config = {}) {
  const base = config.apiBase?.viki || 'https://60s.viki.moe';
  try {
    const res = await axios.get(`${base}/v2/zhihu`, { timeout: 10000 });
    if (res.data?.code === 200 && Array.isArray(res.data.data)) {
      const list = res.data.data.slice(0, 10).map((item, index) => ({
        title: item.title,
        hotValueDesc: item.hot_value_desc || '',
        answerCnt: item.answer_cnt || 0,
        followerCnt: item.follower_cnt || 0,
        commentCnt: item.comment_cnt || 0,
        link: item.link || '',
        cover: item.cover || '',
        rank: index + 1,
      }));
      logSuccess('知乎话题榜', list.length);
      return list;
    }
    throw new Error('API 返回异常');
  } catch (e) {
    logger.error(`[furina-daily] 知乎话题榜 API 请求失败: ${e.message}`);
    if (e.response) {
      logger.error(`状态码: ${e.response.status}`);
      logger.error(`响应体: ${JSON.stringify(e.response.data)}`);
    }
    logFailure('知乎话题榜', true);
    return getMockZhihu();
  }
}