// guoba/schemas/api.js
// 数据源配置：通用基址 + 各模块独立地址
export default [
  {
    component: 'SOFT_GROUP_BEGIN',
    label: '数据源配置'
  },
  {
    component: 'Divider',
    label: '通用地址'
  },
  {
    field: 'apiBase.viki',
    label: '60S API 通用地址',
    component: 'Input',
    bottomHelpMessage: '新闻、摸鱼、知乎、IT、抖音、头条的默认基址，默认 https://60s.viki.moe。下面单独填的地址优先级更高。',
    componentProps: {
      placeholder: 'https://60s.viki.moe'
    }
  },
  {
    component: 'Divider',
    label: '各模块独立地址'
  },
  {
    field: 'apiBase.news60s',
    label: '60S 读世界 API',
    component: 'Input',
    bottomHelpMessage: '留空则使用上面的通用地址；请求失败会自动切换到内置公共实例。',
    componentProps: {
      placeholder: 'https://60s.viki.moe'
    }
  },
  {
    field: 'apiBase.moyu',
    label: '摸鱼日历 API',
    component: 'Input',
    bottomHelpMessage: '留空则使用通用地址。',
    componentProps: {
      placeholder: 'https://60s.viki.moe'
    }
  },
  {
    field: 'apiBase.zhihu',
    label: '知乎话题榜 API',
    component: 'Input',
    bottomHelpMessage: '留空则使用通用地址。',
    componentProps: {
      placeholder: 'https://60s.viki.moe'
    }
  },
  {
    field: 'apiBase.bilibili',
    label: '哔哩哔哩热搜 API',
    component: 'Input',
    bottomHelpMessage: '主域 60s.viki.moe 的 /v2/bili 长期返回 500，默认使用实测可用的 https://60s.7se.cn，可换成其它公共实例。',
    componentProps: {
      placeholder: 'https://60s.7se.cn'
    }
  },
  {
    field: 'apiBase.itNews',
    label: 'IT 资讯 API',
    component: 'Input',
    bottomHelpMessage: '留空则使用通用地址。',
    componentProps: {
      placeholder: 'https://60s.viki.moe'
    }
  },
  {
    field: 'apiBase.douyin',
    label: '抖音热搜 API',
    component: 'Input',
    bottomHelpMessage: '留空则使用通用地址。',
    componentProps: {
      placeholder: 'https://60s.viki.moe'
    }
  },
  {
    field: 'apiBase.toutiao',
    label: '头条热搜 API',
    component: 'Input',
    bottomHelpMessage: '留空则使用通用地址。',
    componentProps: {
      placeholder: 'https://60s.viki.moe'
    }
  },
  {
    field: 'apiBase.bangumi',
    label: '今日新番 API',
    component: 'Input',
    bottomHelpMessage: '新番数据源的基础地址，默认 https://api.bgm.tv',
    componentProps: {
      placeholder: 'https://api.bgm.tv'
    }
  }
]
