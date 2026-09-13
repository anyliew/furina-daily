// src/fetchers/bilibili.js
// B站热搜单独走一条地址：主域 60s.viki.moe 的 /v2/bili 长期返回 500，
// 默认地址取自 docs 公共实例里实测可用的 https://60s.7se.cn，可在锅巴面板自行替换
import { getWithRetry } from '../utils/retry.js';
import { requestWithFallback } from '../utils/apiBase.js';
import { readMock } from '../mock/store.js';
import { logSuccess, logFailure } from '../utils/logger.js';
import { getMockBilibiliHot } from '../mock/bilibili.js';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'application/json, text/plain, */*'
};

export async function fetchBilibiliHot(config = {}, options = {}) {
  try {
    return await requestWithFallback(config, 'bilibili', async (base) => {
      const res = await getWithRetry(`${base}/v2/bili`, { timeout: 12000, headers: HEADERS }, 1, 1500);
      if (res.data?.code === 200 && res.data.data) {
        const list = res.data.data.slice(0, 10).map((item, index) => ({
          title: item.title,
          link: item.link || '',
          hot: true,
          rank: index + 1
        }));
        logSuccess('哔哩哔哩热搜', list.length);
        return list;
      }
      throw new Error('API 返回异常');
    });
  } catch (e) {
    logger.error(`[furina-daily] 哔哩哔哩热搜 API 请求失败: ${e.message}`);
    if (e.code) logger.error(`错误代码: ${e.code}`);
    if (options.useMock === false) throw e;
    const saved = await readMock('bilibili');
    if (saved) return saved;
    logFailure('哔哩哔哩热搜', true);
    return getMockBilibiliHot();
  }
}
