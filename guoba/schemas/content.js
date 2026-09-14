// guoba/schemas/content.js
// 内容配置：日报各板块展示什么
export default [
  {
    component: 'SOFT_GROUP_BEGIN',
    label: '内容配置'
  },
  {
    component: 'Divider',
    label: '板块选择'
  },
  {
    field: 'hotModule',
    label: '热搜板块',
    component: 'Select',
    bottomHelpMessage: '选择下方大图区域展示抖音热搜、今日新番或头条热搜。也可用「日报切换抖音热搜 / 日报切换今日新番 / 日报切换头条热搜」指令快速切换。',
    componentProps: {
      options: [
        { label: '抖音热搜', value: 'douyin' },
        { label: '今日新番', value: 'bangumi' },
        { label: '头条热搜', value: 'toutiao' }
      ]
    }
  },
  {
    field: 'sideModule',
    label: '侧栏话题模块',
    component: 'Select',
    bottomHelpMessage: '侧栏（摸鱼日历旁）二选一：知乎话题榜 或 哔哩哔哩热搜。也可用「日报切换知乎话题榜 / 日报切换B站热搜」指令快速切换。',
    componentProps: {
      options: [
        { label: '知乎话题榜', value: 'zhihu' },
        { label: '哔哩哔哩热搜', value: 'bilibili' }
      ]
    }
  }
]
