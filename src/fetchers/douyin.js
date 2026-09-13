// src/fetchers/douyin.js
import { getWithRetry } from '../utils/retry.js';
import { requestWithFallback } from '../utils/apiBase.js';
import { readMock } from '../mock/store.js';
import { formatHotValue } from '../utils/format.js';
import { logSuccess, logFailure } from '../utils/logger.js';
import { getMockDouyinHot } from '../mock/douyin.js';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'application/json, text/plain, */*'
};

export async function fetchDouyinHot(config = {}, options = {}) {
  try {
    return await requestWithFallback(config, 'douyin', async (base) => {
      const res = await getWithRetry(`${base}/v2/douyin`, { timeout: 12000, headers: HEADERS }, 1, 1500);
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
    });
  } catch (e) {
    logger.error(`[furina-daily] 抖音热搜 API 请求失败: ${e.message}`);
    if (e.code) logger.error(`错误代码: ${e.code}`);
    if (options.useMock === false) throw e;
    const saved = await readMock('douyin');
    if (saved) return saved;
    logFailure('抖音热搜', true);
    return getMockDouyinHot();
  }
}
