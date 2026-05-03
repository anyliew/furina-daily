import { schemas } from './schemas/index.js'
import { loadFullConfig, saveFullConfig } from '../apps/daily.js'

export default {
  schemas,
  getConfigData() {
    const config = loadFullConfig()
    return {
      reportGroup: config.reportGroup || [],
      morningTime: config.morningTime || '0 10 * * *',
      eveningTime: config.eveningTime || '0 22 * * *'
    }
  },
  async setConfigData(data, { Result }) {
    try {
      // 更新写入
      saveFullConfig({
        reportGroup: data.reportGroup || [],
        morningTime: data.morningTime || '0 10 * * *',
        eveningTime: data.eveningTime || '0 22 * * *'
      })
      // 刷新定时任务
      const { scheduleTasks, config } = await import('../apps/daily.js')
      config.morningTime = data.morningTime || '0 10 * * *'
      config.eveningTime = data.eveningTime || '0 22 * * *'
      scheduleTasks()
      return Result.ok({}, '✅ 芙芙日报配置已保存！')
    } catch (error) {
      console.error('[furina-daily] 锅巴配置保存失败:', error)
      return Result.error({}, '❌ 保存失败，请检查日志。')
    }
  }
}