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
    bottomHelpMessage: '两种均为无损画质。PNG（无损）兼容性最好；WebP（无损）体积更小约 30-40%，个别老旧客户端显示兼容性略逊。',
    componentProps: {
      options: [
        { label: 'PNG（无损）', value: 'png' },
        { label: 'WebP（无损）', value: 'webp-lossless' }
      ]
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
    bottomHelpMessage: '排版密度倍率（CSS zoom），会与渲染后端的设备像素倍率相乘。默认 1（shotium scale:2 下为 2 倍图，清晰且体积小）；填 2 为 4 倍图，体积约大 4 倍。',
    componentProps: {
      min: 1,
      max: 4,
      step: 1,
      placeholder: '1'
    }
  }
]
