// guoba/configInfo.js
import { schemas } from './schemas/index.js'
import Config from '../apps/config.js'   // 🔁 修改处

export default {
  schemas,
  getConfigData() {
    const config = Config.get()
    return {
      reportGroup: config.reportGroup || [],
      morningTime: config.morningTime || '0 10 * * *',
      eveningTime: config.eveningTime || '0 22 * * *',
      customTitle: config.customTitle || '芙芙心日报',
      logoImage: config.logoImage || 'logo.png',
      logoSize: config.logoSize || '',
      titleFont: config.titleFont || 'Title.ttf',
      titleFontSize: config.titleFontSize || '',
      secondaryTitleFont: config.secondaryTitleFont || 'Secondary_Title.ttf',
      secondaryTitleFontSize: config.secondaryTitleFontSize || '',
      contentFont: config.contentFont || 'Content.ttf',
      contentFontSize: config.contentFontSize || '',
      hotModule: config.hotModule || 'douyin',
      'apiBase.bangumi': config.apiBase?.bangumi || 'https://api.bgm.tv',
      'apiBase.viki': config.apiBase?.viki || 'https://60s.viki.moe',
      theme: config.theme || 'blue'
    }
  },
  async setConfigData(data, { Result }) {
    try {
      const current = Config.get()
      current.reportGroup = data.reportGroup || []
      current.morningTime = data.morningTime || '0 10 * * *'
      current.eveningTime = data.eveningTime || '0 22 * * *'
      current.customTitle = data.customTitle || '芙芙心日报'
      current.logoImage = data.logoImage || 'logo.png'
      current.logoSize = data.logoSize || ''
      current.titleFont = data.titleFont || 'Title.ttf'
      current.titleFontSize = data.titleFontSize || ''
      current.secondaryTitleFont = data.secondaryTitleFont || 'Secondary_Title.ttf'
      current.secondaryTitleFontSize = data.secondaryTitleFontSize || ''
      current.contentFont = data.contentFont || 'Content.ttf'
      current.contentFontSize = data.contentFontSize || ''
      current.hotModule = data.hotModule || 'douyin'
      current.apiBase = {
        bangumi: data['apiBase.bangumi'] || 'https://api.bgm.tv',
        viki: data['apiBase.viki'] || 'https://60s.viki.moe'
      }
      current.theme = data.theme || 'blue'
      
      Config.set(current)
      return Result.ok({}, '✅ 芙芙日报配置已保存！')
    } catch (error) {
      console.error('[furina-daily] 锅巴配置保存失败:', error)
      return Result.error({}, '❌ 保存失败，请检查日志。')
    }
  }
}