import { format } from 'date-fns';
import { getDateInfo } from '../utils/date.js';

export function getMockMoyuData() {
  const dateInfo = getDateInfo();
  return {
    date: format(new Date(), 'yyyy-MM-dd'),
    weekday: dateInfo.weekday,
    lunar: dateInfo.lunar,
    zodiacYear: '马年 丙午',
    holidayStatus: 'Saturday',
    holidayRemaining: 2,
    lunarFestival: '寒食节',
    countdowns: [
      { name: '劳动节', days: 0, isHighlight: true, special: '今天就是劳动节！尽情摸鱼！' },
      { name: '周末', days: 0, isHighlight: true, special: '今天就是周末！尽情摸鱼！' },
      { name: '月底', days: 12, isHighlight: false },
      { name: '年底', days: 257, isHighlight: false }
    ],
    progress: { week: 86, month: 60, year: 30 },
    nextPayday: {
      name: '劳动节',
      date: '2026-05-01',
      duration: 5,
      noWorkAdjust: true
    },
    motto: '摸鱼使我快乐，加班令我痛苦。人生在世，当然要追求快乐啊！'
  };
}