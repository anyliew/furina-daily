import path from 'path'

const _path = path.resolve(process.cwd(), 'plugins/furina-daily')

export default {
  name: 'furina-daily',
  title: '芙芙日报',
  author: 'Anyliew',
  authorLink: 'https://github.com/anyliew/furina-daily',
  link: 'https://github.com/anyliew/furina-daily',
  isV3: true,
  isV2: false,
  description: '每日早晚定时推送的二次元风格日报，支持订阅、手动获取、刷新',
  showInMenu: 'auto',
  icon: 'mdi:newspaper-variant-outline',
  iconColor: '#88CDF6',
  iconPath: path.join(_path, 'resources/images/logo.png')
}