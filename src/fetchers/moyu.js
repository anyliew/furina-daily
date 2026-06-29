// src/fetchers/moyu.js
import { getWithRetry } from '../utils/retry.js';
import { getMockMoyuData } from '../mock/moyu.js';
import { logSuccess, logFailure } from '../utils/logger.js';

export function parseMoyuText(text) {
  const result = {
    date: null,
    weekday: null,
    lunar: null,
    zodiacYear: null,
    holidayStatus: null,
    holidayRemaining: null,
    lunarFestival: null,
    countdowns: [],
    progress: { week: null, month: null, year: null },
    nextPayday: null,
    motto: null
  };

  const dateMatch = text.match(/📆\s*(\d{4}-\d{2}-\d{2})\s*(星期[一二三四五六日])/);
  if (dateMatch) {
    result.date = dateMatch[1];
    result.weekday = dateMatch[2];
  }
  const lunarMatch = text.match(/🌙\s*农历\s*(.+?)(?:\n|$)/);
  if (lunarMatch) result.lunar = lunarMatch[1].trim();
  const zodiacMatch = text.match(/🐯\s*(.+?年\s*丙午)/);
  if (zodiacMatch) result.zodiacYear = zodiacMatch[1].trim();

  if (text.includes('恭喜！您正处于【') && text.includes('】假期中！')) {
    const holidayNameMatch = text.match(/恭喜！您正处于【([^】]+)】假期中！/);
    if (holidayNameMatch) result.holidayStatus = holidayNameMatch[1];
    const remainMatch = text.match(/还剩\s*(\d+)\s*天（含今天）/);
    if (remainMatch) result.holidayRemaining = parseInt(remainMatch[1], 10);
  }

  const festivalMatch = text.match(/🏮\s*农历节日：(.+)/);
  if (festivalMatch) result.lunarFestival = festivalMatch[1].trim();

  const pattern1 = /距离【([^】]+)】：还要搬砖\s*(\d+)\s*天/g;
  let match;
  while ((match = pattern1.exec(text)) !== null) {
    result.countdowns.push({
      name: match[1],
      days: parseInt(match[2], 10),
      isHighlight: parseInt(match[2], 10) <= 30
    });
  }

  const weekendMatch = text.match(/距离周末：(.+?)(?:\n|$)/);
  if (weekendMatch) {
    if (weekendMatch[1].includes('今天就是周末')) {
      result.countdowns.push({ name: '周末', days: 0, isHighlight: true, special: '今天就是周末！尽情摸鱼！' });
    } else {
      const daysMatch = weekendMatch[1].match(/(\d+)/);
      if (daysMatch) {
        result.countdowns.push({ name: '周末', days: parseInt(daysMatch[1], 10), isHighlight: parseInt(daysMatch[1], 10) <= 3 });
      }
    }
  }

  const monthEndMatch = text.match(/距离月底：还剩\s*(\d+)\s*天/);
  if (monthEndMatch) {
    result.countdowns.push({ name: '月底', days: parseInt(monthEndMatch[1], 10), isHighlight: false });
  }
  const yearEndMatch = text.match(/距离年底：还剩\s*(\d+)\s*天/);
  if (yearEndMatch) {
    result.countdowns.push({ name: '年底', days: parseInt(yearEndMatch[1], 10), isHighlight: false });
  }

  const weekProgress = text.match(/本周\s*(\d+)%/);
  if (weekProgress) result.progress.week = parseInt(weekProgress[1], 10);
  const monthProgress = text.match(/本月\s*(\d+)%/);
  if (monthProgress) result.progress.month = parseInt(monthProgress[1], 10);
  const yearProgress = text.match(/本年\s*(\d+)%/);
  if (yearProgress) result.progress.year = parseInt(yearProgress[1], 10);

  const nextTitleMatch = text.match(/🎊\s*节日：(.+)/);
  const nextDateMatch = text.match(/📅\s*日期：(.+)/);
  const nextDurationMatch = text.match(/⏱️\s*时长：(\d+)\s*天/);
  const nextAdjustMatch = text.match(/💼\s*调休：(.+)/);
  if (nextTitleMatch && nextDateMatch) {
    result.nextPayday = {
      name: nextTitleMatch[1].trim(),
      date: nextDateMatch[1].trim(),
      duration: nextDurationMatch ? parseInt(nextDurationMatch[1], 10) : null,
      noWorkAdjust: nextAdjustMatch ? nextAdjustMatch[1].includes('无需调休') : null
    };
  }

  const mottoMatch = text.match(/💬\s*摸鱼格言\n(.+)/);
  if (mottoMatch) result.motto = mottoMatch[1].trim();

  return result;
}

export async function fetchMoyuData(config = {}) {
  const base = config.apiBase?.viki || 'https://60s.viki.moe';
  const url = `${base}/v2/moyu`;
  const requestConfig = {
    timeout: 15000,
    params: { encoding: 'text' },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/plain, */*'
    }
  };

  try {
    const res = await getWithRetry(url, requestConfig, 3, 3000);
    if (typeof res.data === 'string') {
      logSuccess('摸鱼日历 API (文本)');
      return parseMoyuText(res.data);
    }
    throw new Error('非文本格式');
  } catch (e) {
    logger.error(`[furina-daily] 摸鱼日历 API 请求失败: ${e.message}`);
    if (e.code) logger.error(`错误代码: ${e.code}`);
    logFailure('摸鱼日历 API', true);
    return getMockMoyuData();
  }
}