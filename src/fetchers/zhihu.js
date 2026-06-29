// src/fetchers/zhihu.js
import { getWithRetry } from '../utils/retry.js';
import { logSuccess, logFailure } from '../utils/logger.js';
import { getMockZhihu } from '../mock/zhihu.js';

export async function fetchZhihu(config = {}) {
  const base = config.apiBase?.viki || 'https://60s.viki.moe';
  const url = `${base}/v2/zhihu`;
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
    if (e.code) logger.error(`错误代码: ${e.code}`);
    logFailure('知乎话题榜', true);
    return getMockZhihu();
  }
}