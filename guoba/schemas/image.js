// guoba/schemas/image.js
// 图片配置：出图压缩与渲染倍率
export default [
  {
    component: 'SOFT_GROUP_BEGIN',
    label: '图片配置'
  },
  {
    component: 'Divider',
    label: '图片压缩'
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
    bottomHelpMessage: 'PNG（无压缩）编码最快、体积最大；PNG（无损）画质与渲染结果一致；JPEG / WebP 体积最小但有损。',
    componentProps: {
      options: [
        { label: 'PNG（无压缩）', value: 'png-none' },
        { label: 'PNG（无损）', value: 'png' },
        { label: 'JPEG（体积最小）', value: 'jpeg' },
        { label: 'WebP（兼顾体积与画质）', value: 'webp' }
      ]
    }
  },
  {
    field: 'compressQuality',
    label: '压缩质量',
    component: 'InputNumber',
    bottomHelpMessage: '1-100，数字越大越清晰、体积越大。仅对 JPEG / WebP 生效。',
    componentProps: {
      min: 1,
      max: 100,
      placeholder: '80'
    }
  },
  {
    component: 'Divider',
    label: '渲染'
  },
  {
    field: 'renderScale',
    label: '渲染像素倍率',
    component: 'InputNumber',
    bottomHelpMessage: '2 表示两倍图（默认，更清晰），1 表示原尺寸。仅在渲染后端不支持设备像素比时生效。',
    componentProps: {
      min: 1,
      max: 4,
      step: 1,
      placeholder: '2'
    }
  }
]
