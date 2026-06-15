// plugins/furina-daily/src/dataFetcher.js
import { format } from 'date-fns';
import { fetchNews60s } from './fetchers/news60s.js';
import { fetchMoyuData } from './fetchers/moyu.js';
import { fetchZhihu } from './fetchers/zhihu.js';
import { fetchDouyinHot } from './fetchers/douyin.js';
import { fetchToutiao } from './fetchers/toutiao.js';      // 新增
import { fetchITNews } from './fetchers/itNews.js';
import { fetchQuote } from './fetchers/quote.js';
import { getDateInfo } from './utils/date.js';

export async function fetchAllData(config = {}) {
  console.log('📡 开始获取各模块数据...\n');

  const [news60s, moyuData, zhihuHot, douyinHotList, toutiaoHot, itNews, quote, dateInfo] = await Promise.all([
    fetchNews60s(config),
    fetchMoyuData(config),
    fetchZhihu(config),
    fetchDouyinHot(config),
    fetchToutiao(config),      // 新增
    fetchITNews(config),
    fetchQuote(config),
    Promise.resolve(getDateInfo())
  ]);

  console.log('\n📦 数据汇总:');
  console.log(`   - 世界新闻: ${news60s.worldNews.length} 条`);
  console.log(`   - IT资讯: ${itNews.length} 条`);
  console.log(`   - 知乎话题榜: ${zhihuHot.length} 条`);
  console.log(`   - 抖音热搜: ${douyinHotList.length} 条`);
  console.log(`   - 头条热搜: ${toutiaoHot.length} 条`);   // 新增
  console.log(`   - 摸鱼日历: ${moyuData.countdowns.length} 个倒计时`);
  console.log(`   - 金句: ${quote.text.substring(0, 30)}...\n`);

  return {
    date: dateInfo,
    moyuData,
    zhihuHot,
    douyinHotList,
    toutiaoHot,          // 新增
    worldNews: news60s.worldNews,
    itNews,
    quote,
    generatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss')
  };
}