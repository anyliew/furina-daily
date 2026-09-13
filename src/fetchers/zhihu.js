// src/fetchers/zhihu.js
import { getWithRetry } from '../utils/retry.js';
import { requestWithFallback } from '../utils/apiBase.js';
import { readMock } from '../mock/store.js';
import { getMockZhihu } from '../mock/zhihu.js';
import { logSuccess, logFailure } from '../utils/logger.js';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'application/json, text/plain, */*'
};

export async function fetchZhihu(config = {}, options = {}) {
  try {
    return await requestWithFallback(config, 'zhihu', async (base) => {
      const res = await getWithRetry(`${base}/v2/zhihu`, { timeout: 12000, headers: HEADERS }, 1, 1500);
      if (res.data?.code === 200 && Array.isArray(res.data.data) && res.data.data.length) {
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
    });
  } catch (e) {
    logger.error(`[furina-daily] 知乎话题榜 API 请求失败: ${e.message}`);
    if (e.code) logger.error(`错误代码: ${e.code}`);
    if (options.useMock === false) throw e;
    const saved = await readMock('zhihu');
    if (saved) return saved;
    logFailure('知乎话题榜', true);
    return getMockZhihu();
  }
}
