import axios from 'axios';
import { getMockQuote } from '../mock/quote.js';
import { logSuccess, logFailure } from '../utils/logger.js';

export async function fetchQuote() {
  try {
    const res = await axios.get('https://60s.viki.moe/v2/hitokoto', { timeout: 5000 });
    if (res.data?.code === 200 && res.data.data) {
      logSuccess('一言金句');
      return {
        text: res.data.data.hitokoto,
        from: '芙芙日报·一言'
      };
    }
    throw new Error('API 返回异常');
  } catch (e) {
    logger.error(`[furina-daily] 一言金句 API 请求失败: ${e.message}`);
    if (e.response) {
      logger.error(`状态码: ${e.response.status}`);
      logger.error(`响应体: ${JSON.stringify(e.response.data)}`);
    }
    logFailure('一言金句', true);
    return getMockQuote();
  }
}