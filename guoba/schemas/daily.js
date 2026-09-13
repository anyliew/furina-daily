// guoba/schemas/daily.js
export default [
  {
    field: 'reportGroup',
    label: '日报推送群',
    component: 'GTags',
    bottomHelpMessage: '需要接收日报的QQ群号列表，输入后按回车添加。',
    componentProps: {
      placeholder: '请输入群号，按回车确认',
      allowAdd: true,
      allowDel: true
    }
  },
  {
    field: 'morningTime',
    label: '早间推送时间',
    component: 'Input',
    bottomHelpMessage: 'Cron 表达式，默认 0 10 * * *（每天10:00）',
    componentProps: {
      placeholder: '0 10 * * *'
    }
  },
  {
    field: 'eveningTime',
    label: '晚间推送时间',
    component: 'Input',
    bottomHelpMessage: 'Cron 表达式，默认 0 22 * * *（每天22:00）',
    componentProps: {
      placeholder: '0 22 * * *'
    }
  },
  {
    field: 'customTitle',
    label: '日报标题',
    component: 'Input',
    bottomHelpMessage: '自定义日报顶部标题文字，默认为“芙芙心日报”。',
    componentProps: {
      placeholder: '芙芙心日报'
    }
  },
  {
    field: 'logoImage',
    label: 'Logo 图片文件名',
    component: 'Input',
    bottomHelpMessage: '填写图片文件名（如 logo.png），存放在 resources/images/ 目录下。留空默认使用 logo.png。',
    componentProps: {
      placeholder: 'logo.png'
    }
  },
  {
    field: 'logoSize',
    label: 'Logo 大小',
    component: 'Input',
    bottomHelpMessage: '设置 Logo 图片的宽高（单位 px），留空则使用原始大小。',
    componentProps: {
      placeholder: '64'
    }
  },
  {
    field: 'titleFont',
    label: '顶部标题字体',
    component: 'Input',
    bottomHelpMessage: '字体文件名（如 Title.ttf），放在 resources/font 下。留空则使用 Title.ttf。',
    componentProps: {
      placeholder: 'Title.ttf'
    }
  },
  {
    field: 'titleFontSize',
    label: '顶部标题字号',
    component: 'Input',
    bottomHelpMessage: '数字（单位 px），留空则使用默认大小。',
    componentProps: {
      placeholder: '40'
    }
  },
  {
    field: 'secondaryTitleFont',
    label: '内容标题字体',
    component: 'Input',
    bottomHelpMessage: '字体文件名（如 Secondary_Title.ttf），用于模块标题。',
    componentProps: {
      placeholder: 'Secondary_Title.ttf'
    }
  },
  {
    field: 'secondaryTitleFontSize',
    label: '内容标题字号',
    component: 'Input',
    bottomHelpMessage: '数字（单位 px），留空则使用默认大小。',
    componentProps: {
      placeholder: '24'
    }
  },
  {
    field: 'contentFont',
    label: '正文文字字体',
    component: 'Input',
    bottomHelpMessage: '字体文件名（如 Content.ttf），用于正文内容。',
    componentProps: {
      placeholder: 'Content.ttf'
    }
  },
  {
    field: 'contentFontSize',
    label: '正文文字字号',
    component: 'Input',
    bottomHelpMessage: '数字（单位 px），留空则使用默认大小。',
    componentProps: {
      placeholder: '18'
    }
  },
  {
    field: 'hotModule',
    label: '热搜板块',
    component: 'Select',
    bottomHelpMessage: '选择下方大图区域展示抖音热搜、今日新番或头条热搜',
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
    bottomHelpMessage: '侧栏（摸鱼日历旁）二选一：知乎话题榜 或 哔哩哔哩热搜',
    componentProps: {
      options: [
        { label: '知乎话题榜', value: 'zhihu' },
        { label: '哔哩哔哩热搜', value: 'bilibili' }
      ]
    }
  },
  {
    field: 'renderScale',
    label: '渲染像素倍率',
    component: 'Input',
    bottomHelpMessage: '数字，2 表示两倍图（默认，更清晰），1 表示原尺寸。仅在渲染后端不支持设备像素比时生效。',
    componentProps: {
      placeholder: '2'
    }
  },
  {
    field: 'compressImage',
    label: '压缩日报图片',
    component: 'Switch',
    bottomHelpMessage: '关闭则直接输出渲染后端返回的原始图片（体积更大、画质无损）。也可用指令「日报压缩 开/关」切换。'
  },
  {
    field: 'compressFormat',
    label: '压缩格式',
    component: 'Select',
    bottomHelpMessage: 'png 为无损压缩（体积中等），jpeg / webp 体积最小但有损',
    componentProps: {
      options: [
        { label: 'PNG（无损）', value: 'png' },
        { label: 'JPEG（体积最小）', value: 'jpeg' },
        { label: 'WebP（兼顾体积与画质）', value: 'webp' }
      ]
    }
  },
  {
    field: 'compressQuality',
    label: '压缩质量',
    component: 'Input',
    bottomHelpMessage: '1-100，数字越大越清晰、体积越大。仅对 JPEG / WebP 生效。',
    componentProps: {
      placeholder: '80'
    }
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
  },
  {
    field: 'theme',
    label: '日报主题',
    component: 'Select',
    bottomHelpMessage: '选择日报的配色主题',
    componentProps: {
      options: [
        { label: '芙芙蓝色', value: 'blue' },
        { label: '真寻粉色', value: 'pink' }
      ]
    }
  }
];
