import { schemas } from './schemas/index.js'
import { loadFullConfig, saveFullConfig } from '../apps/daily.js'

export default {
  schemas,
  getConfigData() {
    const config = loadFullConfig()
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
      hotModule: config.hotModule || 'douyin'
    }
  },
  async setConfigData(data, { Result }) {
    try {
      saveFullConfig({
        reportGroup: data.reportGroup || [],
        morningTime: data.morningTime || '0 10 * * *',
        eveningTime: data.eveningTime || '0 22 * * *',
        customTitle: data.customTitle || '芙芙心日报',
        logoImage: data.logoImage || 'logo.png',
        logoSize: data.logoSize || '',
        titleFont: data.titleFont || 'Title.ttf',
        titleFontSize: data.titleFontSize || '',
        secondaryTitleFont: data.secondaryTitleFont || 'Secondary_Title.ttf',
        secondaryTitleFontSize: data.secondaryTitleFontSize || '',
        contentFont: data.contentFont || 'Content.ttf',
        contentFontSize: data.contentFontSize || '',
        hotModule: data.hotModule || 'douyin'
      })
      const { scheduleTasks, config } = await import('../apps/daily.js')
      Object.assign(config, {
        morningTime: data.morningTime || '0 10 * * *',
        eveningTime: data.eveningTime || '0 22 * * *',
        customTitle: data.customTitle || '芙芙心日报',
        logoImage: data.logoImage || 'logo.png',
        logoSize: data.logoSize || '',
        titleFont: data.titleFont || 'Title.ttf',
        titleFontSize: data.titleFontSize || '',
        secondaryTitleFont: data.secondaryTitleFont || 'Secondary_Title.ttf',
        secondaryTitleFontSize: data.secondaryTitleFontSize || '',
        contentFont: data.contentFont || 'Content.ttf',
        contentFontSize: data.contentFontSize || '',
        hotModule: data.hotModule || 'douyin'
      })
      scheduleTasks()
      return Result.ok({}, '✅ 芙芙日报配置已保存！')
    } catch (error) {
      console.error('[furina-daily] 锅巴配置保存失败:', error)
      return Result.error({}, '❌ 保存失败，请检查日志。')
    }
  }
}