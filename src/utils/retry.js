// src/utils/retry.js
import axios from 'axios';

/**
 * 带重试的 axios GET 请求
 * @param {string} url - 请求地址
 * @param {object} config - axios 配置（超时、头等）
 * @param {number} maxRetries - 最大重试次数（默认 3）
 * @param {number} initialDelay - 首次重试等待时间（毫秒，默认 3000）
 * @returns {Promise<object>} axios 响应对象
 */
export async function getWithRetry(url, config = {}, maxRetries = 3, initialDelay = 3000) {
  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, config);
      return response; // 成功则返回
    } catch (error) {
      lastError = error;
      // 检查是否为 429 且还有重试次数
      if (error.response?.status === 429 && attempt < maxRetries) {
        // 优先使用 API 返回的 retry_after，但不超过 10 秒
        let waitTime = Math.min(delay, 10000);
        if (error.response?.data?.retry_after) {
          waitTime = Math.min(error.response.data.retry_after * 1000, 10000);
        }
        logger.warn(`[furina-daily] 触发速率限制 (429)，等待 ${(waitTime/1000).toFixed(1)} 秒后重试 (尝试 ${attempt+1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        // 指数退避，下次等待时间翻倍（但不超过 10 秒）
        delay = Math.min(delay * 2, 10000);
        continue;
      }
      // 其他错误直接抛出
      throw error;
    }
  }
  throw lastError; // 所有重试失败
}