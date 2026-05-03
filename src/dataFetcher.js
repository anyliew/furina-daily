// src/dataFetcher.js
import { format } from 'date-fns';
import { fetchNews60s } from './fetchers/news60s.js';
import { fetchMoyuData } from './fetchers/moyu.js';
import { fetchBilibiliHot } from './fetchers/bilibili.js';
import { fetchDouyinHot } from './fetchers/douyin.js';
import { fetchITNews } from './fetchers/itNews.js';
import { fetchQuote } from './fetchers/quote.js';
import { getDateInfo } from './utils/date.js';

export async function fetchAllData() {
  console.log('📡 开始获取各模块数据...\n');  // 此处 console 可保留作为进度提示

  const [news60s, moyuData, bilibiliHot, douyinHotList, itNews, quote, dateInfo] = await Promise.all([
    fetchNews60s(),
    fetchMoyuData(),
    fetchBilibiliHot(),
    fetchDouyinHot(),
    fetchITNews(),
    fetchQuote(),
    Promise.resolve(getDateInfo())
  ]);

  console.log('\n📦 数据汇总:');
  console.log(`   - 世界新闻: ${news60s.worldNews.length} 条`);
  console.log(`   - IT资讯: ${itNews.length} 条`);
  console.log(`   - B站热点: ${bilibiliHot.length} 条`);
  console.log(`   - 抖音热搜: ${douyinHotList.length} 条`);
  console.log(`   - 摸鱼日历: ${moyuData.countdowns.length} 个倒计时`);
  console.log(`   - 金句: ${quote.text.substring(0, 30)}...\n`);

  return {
    date: dateInfo,
    moyuData,
    bilibiliHot,
    douyinHotList,
    worldNews: news60s.worldNews,
    itNews,
    quote,
    generatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss')
  };
}