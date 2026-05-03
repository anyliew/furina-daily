import axios from 'axios';
import { getMockBilibiliHot } from '../mock/bilibili.js';
import { logSuccess, logFailure } from '../utils/logger.js';

export async function fetchBilibiliHot() {
  try {
    const res = await axios.get('https://60s.viki.moe/v2/bili', { timeout: 10000 });
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
    logFailure('B站热点', true);
    return getMockBilibiliHot();
  }
}