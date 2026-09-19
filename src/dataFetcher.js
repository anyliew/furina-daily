// src/dataFetcher.js
import { format } from 'date-fns';
import { fetchNews60s } from './fetchers/news60s.js';
import { fetchMoyuData } from './fetchers/moyu.js';
import { fetchZhihu } from './fetchers/zhihu.js';
import { fetchBilibiliHot } from './fetchers/bilibili.js';
import { fetchITNews } from './fetchers/itNews.js';
import { getDateInfo } from './utils/date.js';
import { logMark } from './utils/logger.js';

/**
 * 带延迟的函数执行器
 * @param {Function} fn - 要执行的异步函数
 * @param {number} delay - 延迟时间（毫秒）
 * @param {object} config - 传递给 fetcher 的配置
 * @param {object} options - fetcher 选项（如 useMock）
 * @returns {Promise<any>}
 */
async function fetchWithDelay(fn, delay, config, options) {
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return fn(config, options);
}

/** 侧栏模块：知乎话题榜 或 哔哩哔哩热搜（二选一） */
export function resolveSideModule(config = {}) {
  return config.sideModule === 'bilibili' ? 'bilibili' : 'zhihu';
}

export async function fetchAllData(config = {}, options = {}) {
  logMark('📡 开始获取固定模块数据（新闻、摸鱼、侧栏、IT）...');

  const sideModule = resolveSideModule(config);

  // 串行请求固定模块，间隔 1 秒，避免触发速率限制
  const news60s = await fetchWithDelay(fetchNews60s, 0, config, options);
  const moyuData = await fetchWithDelay(fetchMoyuData, 1000, config, options);

  let zhihuHot = [];
  let bilibiliHot = [];
  if (sideModule === 'bilibili') {
    bilibiliHot = await fetchWithDelay(fetchBilibiliHot, 1000, config, options);
  } else {
    zhihuHot = await fetchWithDelay(fetchZhihu, 1000, config, options);
  }

  const itNews = await fetchWithDelay(fetchITNews, 1000, config, options);
  const dateInfo = getDateInfo();

  const sideName = sideModule === 'bilibili' ? '哔哩哔哩热搜' : '知乎话题榜';
  const sideCount = sideModule === 'bilibili' ? bilibiliHot.length : zhihuHot.length;

  logMark(
    [
      '📦 固定数据汇总:',
      `  - 世界新闻: ${news60s.worldNews.length} 条`,
      `  - IT资讯: ${itNews.length} 条`,
      `  - ${sideName}: ${sideCount} 条`,
      `  - 摸鱼日历: ${moyuData.countdowns.length} 个倒计时`
    ].join('\n')
  );

  return {
    date: dateInfo,
    moyuData,
    zhihuHot,
    bilibiliHot,
    sideModule,
    worldNews: news60s.worldNews,
    itNews,
    generatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss')
  };
}

/** 全部走本地示例数据（不请求网络），用于「日报模拟」预览渲染效果 */
export async function fetchAllMockData(config = {}) {
  const { readMock } = await import('./mock/store.js');
  const { getMockNews60s } = await import('./mock/news60s.js');
  const { getMockMoyuData } = await import('./mock/moyu.js');
  const { getMockZhihu } = await import('./mock/zhihu.js');
  const { getMockBilibiliHot } = await import('./mock/bilibili.js');
  const { getMockITNews } = await import('./mock/itNews.js');
  const { getMockDouyinHot } = await import('./mock/douyin.js');
  const { getMockToutiao } = await import('./mock/toutiao.js');
  const { getDateInfo } = await import('./utils/date.js');

  const [news60s, moyuRaw, zhihuHot, bilibiliHot, itNews, douyinHot, toutiaoHot] = await Promise.all([
    readMock('news60s').then(v => v || getMockNews60s()),
    readMock('moyu').then(v => v || getMockMoyuData()),
    readMock('zhihu').then(v => v || getMockZhihu()),
    readMock('bilibili').then(v => v || getMockBilibiliHot()),
    readMock('itNews').then(v => v || getMockITNews()),
    readMock('douyin').then(v => v || getMockDouyinHot()),
    readMock('toutiao').then(v => v || getMockToutiao())
  ]);
  const bangumi = await readMock('bangumi');

  const dateInfo = getDateInfo();
  // 示例数据里的日期是录制当天的，预览时用当前日期覆盖，避免日报上出现过期日期
  const moyuData = (moyuRaw && typeof moyuRaw === 'object' && !Array.isArray(moyuRaw))
    ? { ...moyuRaw, date: dateInfo.gregorian, weekday: `星期${dateInfo.weekday}`, lunar: dateInfo.lunar }
    : moyuRaw;

  return {
    date: dateInfo,
    moyuData,
    zhihuHot,
    bilibiliHot,
    sideModule: resolveSideModule(config),
    worldNews: news60s.worldNews || [],
    itNews: itNews || [],
    douyinHot: douyinHot || [],
    toutiaoHot: toutiaoHot || [],
    bangumiData: bangumi || null,
    generatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss')
  };
}
