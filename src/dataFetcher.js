// src/dataFetcher.js
import { format } from 'date-fns';
import { fetchNews60s } from './fetchers/news60s.js';
import { fetchMoyuData } from './fetchers/moyu.js';
import { fetchZhihu } from './fetchers/zhihu.js';
import { fetchITNews } from './fetchers/itNews.js';
import { getDateInfo } from './utils/date.js';

/**
 * 带延迟的函数执行器
 * @param {Function} fn - 要执行的异步函数
 * @param {number} delay - 延迟时间（毫秒）
 * @param {object} config - 传递给 fetcher 的配置
 * @returns {Promise<any>}
 */
async function fetchWithDelay(fn, delay, config) {
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return fn(config);
}

export async function fetchAllData(config = {}) {
  console.log('📡 开始获取固定模块数据（新闻、摸鱼、知乎、IT）...\n');

  // 串行请求固定模块，间隔 1 秒，避免触发速率限制
  const news60s = await fetchWithDelay(fetchNews60s, 0, config);
  const moyuData = await fetchWithDelay(fetchMoyuData, 1000, config);
  const zhihuHot = await fetchWithDelay(fetchZhihu, 1000, config);
  const itNews = await fetchWithDelay(fetchITNews, 1000, config);
  const dateInfo = getDateInfo();

  console.log('\n📦 固定数据汇总:');
  console.log(`   - 世界新闻: ${news60s.worldNews.length} 条`);
  console.log(`   - IT资讯: ${itNews.length} 条`);
  console.log(`   - 知乎话题榜: ${zhihuHot.length} 条`);
  console.log(`   - 摸鱼日历: ${moyuData.countdowns.length} 个倒计时\n`);

  return {
    date: dateInfo,
    moyuData,
    zhihuHot,
    worldNews: news60s.worldNews,
    itNews,
    generatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss')
  };
}