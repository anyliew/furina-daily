// src/utils/date.js
import { format } from 'date-fns';
import { Lunar } from 'lunar-javascript';

export function getDateInfo() {
  const now = new Date();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']; // 直接存短字
  const lunar = Lunar.fromDate(now);

  return {
    weekday: weekdays[now.getDay()],          // 完整显示用（如需要）
    weekdayShort: weekdays[now.getDay()],     // 已经是一个字
    gregorian: format(now, 'yyyy-MM-dd'),
    lunar: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`
  };
}

export function getLunarDate(date) {
  const lunar = Lunar.fromDate(date);
  return `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
}