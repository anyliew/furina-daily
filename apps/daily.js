// apps/daily.js
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import schedule from 'node-schedule'
import Config from './config.js'   // 🔁 修改处
import { generateDaily, closeBrowser } from '../src/index.js'

const { default: Plugin } = await import('../../../lib/plugins/plugin.js')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pluginRoot = path.resolve(__dirname, '..')

let segment
try {
  segment = (await import('icqq')).segment
} catch {
  segment = global.segment || { image: (file) => `[CQ:image,file=${file}]` }
}

// ---------- 初始化配置（合并 + 监听热更新） ----------
let config = Config.init()

Config.onChange((newConfig) => {
  config = newConfig
  scheduleTasks()
})

// ---------- 定时任务 ----------
let morningJob = null
let eveningJob = null
let refreshJobs = []
let isGenerating = false

let cachedImagePath = null
let cachedDate = ''

function getTodayStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function addReportGroup(groupId) {
  if (config.reportGroup.includes(groupId)) return false
  config.reportGroup.push(groupId)
  Config.set(config)
  return true
}

function removeReportGroup(groupId) {
  const index = config.reportGroup.indexOf(groupId)
  if (index === -1) return false
  config.reportGroup.splice(index, 1)
  Config.set(config)
  return true
}

async function generateAndGetImage(forceRefresh = false) {
  const today = getTodayStr()
  if (!forceRefresh && cachedImagePath && cachedDate === today && fs.existsSync(cachedImagePath)) {
    logger.debug(`[furina-daily] 使用今日缓存: ${cachedImagePath}`)
    return cachedImagePath
  }

  if (isGenerating) {
    logger.warn('[furina-daily] 日报生成任务进行中，跳过')
    return null
  }
  isGenerating = true
  try {
    logger.mark('[furina-daily] 开始生成芙芙日报...')
    const imagePath = await generateDaily(config)
    logger.mark(`[furina-daily] 日报生成成功: ${imagePath}`)

    try {
      const dir = path.dirname(imagePath)
      const newFileName = path.basename(imagePath)
      const files = fs.readdirSync(dir)
      let deletedCount = 0
      for (const file of files) {
        const filePath = path.join(dir, file)
        if (file !== newFileName && /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(file)) {
          fs.unlinkSync(filePath)
          deletedCount++
        }
      }
      if (deletedCount > 0) logger.debug(`[furina-daily] 已清理 ${deletedCount} 个旧图片`)
    } catch (err) {
      logger.warn(`[furina-daily] 清理旧图片错误: ${err.message}`)
    }

    cachedImagePath = imagePath
    cachedDate = today
    return imagePath
  } catch (err) {
    logger.error(`[furina-daily] 生成失败: ${err.message}`)
    return null
  } finally {
    isGenerating = false
  }
}

async function sendImageToSession(session, imagePath) {
  if (!imagePath || !fs.existsSync(imagePath)) {
    await session.reply("❌ 日报文件丢失，生成失败。")
    return false
  }
  try {
    await session.reply(segment.image(imagePath))
    return true
  } catch (err) {
    logger.error(`[furina-daily] 发送失败: ${err.message}`)
    await session.reply("❌ 发送日报失败。")
    return false
  }
}

async function sendDailyToAll() {
  const imagePath = await generateAndGetImage()
  if (!imagePath) return
  const bot = Bot
  for (const groupId of config.reportGroup) {
    try {
      const group = await bot.pickGroup(groupId)
      await group.sendMsg(segment.image(imagePath))
      logger.mark(`[furina-daily] 已发送至群 ${groupId}`)
      await sleep(1000)
    } catch (err) {
      logger.error(`[furina-daily] 发送失败群 ${groupId}: ${err.message}`)
    }
  }
}

export function scheduleTasks() {
  if (morningJob) morningJob.cancel()
  if (eveningJob) eveningJob.cancel()
  refreshJobs.forEach(job => job.cancel())
  refreshJobs = []

  morningJob = schedule.scheduleJob(config.morningTime, async () => {
    logger.mark(`[furina-daily] 早间推送 (${config.morningTime})`)
    await sendDailyToAll()
  })
  eveningJob = schedule.scheduleJob(config.eveningTime, async () => {
    logger.mark(`[furina-daily] 晚间推送 (${config.eveningTime})`)
    await sendDailyToAll()
  })

  const refreshTimes = [
    { cron: '30 7 * * *', desc: '上午7:30' },
    { cron: '30 9 * * *', desc: '上午9:30' },
    { cron: '30 17 * * *', desc: '下午5:30' },
    { cron: '0 21 * * *', desc: '晚上9:00' }
  ]
  refreshTimes.forEach(({ cron, desc }) => {
    const job = schedule.scheduleJob(cron, async () => {
      logger.mark(`[furina-daily] ${desc} 刷新缓存`)
      await generateAndGetImage(true)
    })
    refreshJobs.push(job)
  })
  logger.mark(`[furina-daily] 定时任务已设置: 早 ${config.morningTime}, 晚 ${config.eveningTime}`)
}

scheduleTasks()

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export { config }

export default class furinaDaily extends Plugin {
  constructor() {
    super({
      name: "芙芙日报",
      dsc: "每日早晚定时推送，支持订阅、手动获取、刷新",
      event: "message",
      priority: 5000,
      rule: [
        { reg: "^开启日报推送$", fnc: "subscribeGroup" },
        { reg: "^关闭日报推送$", fnc: "unsubscribeGroup" },
        { reg: "^(芙芙日报|日报)$", fnc: "manualDaily" },
        { reg: "^刷新日报$", fnc: "refreshDaily" },
        { reg: "^日报清空配置$", fnc: "clearConfig" },
        { reg: "^日报切换抖音热搜$", fnc: "switchDouyin" },
        { reg: "^日报切换今日新番$", fnc: "switchBangumi" },
        { reg: /^日报主题切换\s*(.*)$/, fnc: "switchTheme" }
      ]
    })
  }

  async subscribeGroup(e) {
    if (!e.isGroup) return e.reply("❌ 仅群聊可用")
    const groupId = e.group_id
    if (addReportGroup(groupId)) {
      e.reply(`✅ 已开启日报推送！本群将在每日${config.morningTime}和${config.eveningTime}自动发送日报。`)
    } else {
      e.reply(`🌸 本群已开启日报推送，无需重复操作。`)
    }
  }

  async unsubscribeGroup(e) {
    if (!e.isGroup) return e.reply("❌ 仅群聊可用")
    const groupId = e.group_id
    if (removeReportGroup(groupId)) {
      e.reply(`❎ 已关闭日报推送。`)
    } else {
      e.reply(`🍃 本群未开启日报推送。`)
    }
  }

  async manualDaily(e) {
    logger.debug(`[furina-daily] 手动获取日报 by ${e.user_id}`)
    const imagePath = await generateAndGetImage()
    if (imagePath) {
      await sendImageToSession(e, imagePath)
    } else {
      await e.reply("❌ 日报生成失败。")
    }
  }

  async refreshDaily(e) {
    logger.debug(`[furina-daily] 刷新日报 by ${e.user_id}`)
    await e.reply("🔄 正在刷新日报...")
    const imagePath = await generateAndGetImage(true)
    if (imagePath) {
      await e.reply(segment.image(imagePath))
    } else {
      await e.reply("❌ 日报刷新失败。")
    }
  }

  async clearConfig(e) {
    if (!e.isMaster) {
      await e.reply('❌ 仅BOT主人可使用此命令')
      return false
    }
    try {
      const userConfigPath = path.join(pluginRoot, 'config', 'config', 'daily.yaml')
      const backupDir = path.dirname(userConfigPath)
      const now = new Date()
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
      const randomStr = Math.random().toString(36).slice(2, 8)
      const backupName = `daily_${dateStr}_${timeStr}_${randomStr}.yaml`
      const backupPath = path.join(backupDir, backupName)

      if (fs.existsSync(userConfigPath)) {
        fs.copyFileSync(userConfigPath, backupPath)
        logger.mark(`[furina-daily] 配置已备份至 ${backupName}`)
      }

      const defaultConfigPath = path.join(pluginRoot, 'config', 'default_config', 'daily.yaml')
      fs.copyFileSync(defaultConfigPath, userConfigPath)
      logger.mark('[furina-daily] 配置已重置为默认')

      config = Config.init()
      scheduleTasks()

      await e.reply(`✅ 日报配置已重置为默认，原配置备份为 ${backupName}`)
    } catch (err) {
      logger.error('[furina-daily] 清空配置失败:', err)
      await e.reply(`❌ 清空配置失败：${err.message}`)
    }
    return true
  }

  async switchDouyin(e) {
    if (!e.isMaster) {
      await e.reply('❌ 仅BOT主人可使用此命令')
      return false
    }
    if (config.hotModule === 'douyin') {
      await e.reply('当前热搜板块已是抖音热搜，无需切换')
      return true
    }
    config.hotModule = 'douyin'
    Config.set(config)
    logger.mark('[furina-daily] 已切换至抖音热搜')
    await e.reply('✅ 已切换为抖音热搜，下次生成日报时生效')
    return true
  }

  async switchBangumi(e) {
    if (!e.isMaster) {
      await e.reply('❌ 仅BOT主人可使用此命令')
      return false
    }
    if (config.hotModule === 'bangumi') {
      await e.reply('当前热搜板块已是今日新番，无需切换')
      return true
    }
    config.hotModule = 'bangumi'
    Config.set(config)
    logger.mark('[furina-daily] 已切换至今日新番')
    await e.reply('✅ 已切换为今日新番，下次生成日报时生效')
    return true
  }

  async switchTheme(e) {
    if (!e.isMaster) {
      await e.reply('❌ 仅BOT主人可使用此命令')
      return false
    }
    const msg = e.msg || e.message || ''
    if (/芙芙蓝色/.test(msg)) {
      config.theme = 'blue'
      Config.set(config)
      await e.reply('✅ 已切换至主题【芙芙蓝色】，下次生成日报时生效')
      return true
    }
    if (/真寻粉色/.test(msg)) {
      config.theme = 'pink'
      Config.set(config)
      await e.reply('✅ 已切换至主题【真寻粉色】，下次生成日报时生效')
      return true
    }
    await e.reply('❌ 主题名称错误，可用主题：芙芙蓝色、真寻粉色。示例：日报主题切换 芙芙蓝色')
    return false
  }
}