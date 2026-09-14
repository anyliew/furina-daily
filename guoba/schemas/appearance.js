// guoba/schemas/appearance.js
// 外观配置：标题、Logo、字体、主题配色
export default [
  {
    component: 'SOFT_GROUP_BEGIN',
    label: '外观配置'
  },
  {
    component: 'Divider',
    label: '标题与 Logo'
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
    component: 'Divider',
    label: '字体设置'
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
    component: 'Divider',
    label: '配色主题'
  },
  {
    field: 'theme',
    label: '日报主题',
    component: 'Select',
    bottomHelpMessage: '选择日报的配色主题。也可用指令「芙芙蓝色 / 真寻粉色」快速切换。',
    componentProps: {
      options: [
        { label: '芙芙蓝色', value: 'blue' },
        { label: '真寻粉色', value: 'pink' }
      ]
    }
  }
]
