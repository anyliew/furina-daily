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
    bottomHelpMessage: '选择展示抖音热搜或今日新番',
    componentProps: {
      options: [
        { label: '抖音热搜', value: 'douyin' },
        { label: '今日新番', value: 'bangumi' }
      ]
    }
  }
];