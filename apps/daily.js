// apps/daily.js
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import schedule from 'node-schedule'
import Config from './config.js'
import { generateDaily, closeBrowser, resolveCompress, compressFormatLabel } from '../src/index.js'
import { getMockStatus } from '../src/mock/store.js'
import { getCurrentBase } from '../src/utils/apiBase.js'

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

/** 配置变更后让「今日缓存」失效，确保下次手动/定时生成时用新配置出图（否则会一直返回当天旧图） */
function invalidateDailyCache() {
  cachedImagePath = null
  cachedDate = ''
}

function getTodayStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** 群号统一按字符串比较：锅巴群列表给出的可能是数字，而群消息里的 group_id 也可能是字符串 */
function normalizeGroupId(id) {
  return String(id ?? '').trim()
}

function addReportGroup(groupId) {
  const id = normalizeGroupId(groupId)
  if (!id) return false
  const list = Array.isArray(config.reportGroup) ? config.reportGroup : (config.reportGroup = [])
  if (list.some(g => normalizeGroupId(g) === id)) return false
  list.push(groupId)
  Config.set(config)
  return true
}

function removeReportGroup(groupId) {
  const id = normalizeGroupId(groupId)
  const list = Array.isArray(config.reportGroup) ? config.reportGroup : []
  const index = list.findIndex(g => normalizeGroupId(g) === id)
  if (index === -1) return false
  list.splice(index, 1)
  Config.set(config)
  return true
}

async function generateAndGetImage(forceRefresh = false, options = {}) {
  const today = getTodayStr()
  if (!forceRefresh && !options.useMock && cachedImagePath && cachedDate === today && fs.existsSync(cachedImagePath)) {
    logger.debug(`[furina-daily] 使用今日缓存: ${cachedImagePath}`)
    return cachedImagePath
  }

  if (isGenerating) {
    logger.warn('[furina-daily] 日报生成任务进行中，跳过')
    return null
  }
  isGenerating = true
  try {
    logger.mark(`[furina-daily] 开始生成芙芙日报${options.useMock ? '（本地示例数据 · 渲染预览）' : ''}...`)
    const imagePath = await generateDaily(config, {
      useMock: options.useMock === true,
      compress: resolveCompress(config)
    })
    logger.mark(`[furina-daily] 日报生成成功: ${imagePath}`)

    // 模拟日报只是预览，不占用今日缓存，否则会把模拟图当正式日报发出去
    if (options.useMock) return imagePath

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
  const groups = Array.isArray(config.reportGroup) ? config.reportGroup : []
  if (!groups.length) {
    logger.warn('[furina-daily] 推送群列表为空，跳过本次推送')
    return
  }
  for (const groupId of groups) {
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
        { reg: "^日报切换头条热搜$", fnc: "switchToutiao" },
        { reg: /^日报切换(知乎话题榜|知乎)$/i, fnc: "switchZhihu" },
        { reg: /^日报切换(b站热搜|哔哩哔哩热搜|bili)$/i, fnc: "switchBilibili" },
        { reg: /^日报压缩\s*(开|关|on|off)?$/i, fnc: "toggleCompress" },
        { reg: /^日报模拟$/, fnc: "mockDaily" },
        { reg: /^日报数据源$/, fnc: "showApiStatus" },
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
    if (!e.isMaster) {
      logger.debug(`[furina-daily] 非主人尝试刷新日报: ${e.user_id}，已忽略`)
      return false
    }
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
      invalidateDailyCache()
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
    invalidateDailyCache()
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
    invalidateDailyCache()
    logger.mark('[furina-daily] 已切换至今日新番')
    await e.reply('✅ 已切换为今日新番，下次生成日报时生效')
    return true
  }

  async switchToutiao(e) {
    if (!e.isMaster) {
      await e.reply('❌ 仅BOT主人可使用此命令')
      return false
    }
    if (config.hotModule === 'toutiao') {
      await e.reply('当前热搜板块已是头条热搜，无需切换')
      return true
    }
    config.hotModule = 'toutiao'
    Config.set(config)
    invalidateDailyCache()
    logger.mark('[furina-daily] 已切换至头条热搜')
    await e.reply('✅ 已切换为头条热搜，下次生成日报时生效')
    return true
  }

  async switchTheme(e) {
    if (!e.isMaster) {
      await e.reply('❌ 仅BOT主人可使用此命令')
      return false
    }
    const msg = e.msg || e.message || ''
    const THEMES = [
      [/芙芙蓝色/, 'blue', '芙芙蓝色'],
      [/真寻粉色/, 'pink', '真寻粉色'],
      [/霜笺白鹭/, 'lu', '霜笺白鹭'],
      [/绿野青穗/, 'green', '绿野青穗'],
      [/素白简讯/, 'plain', '素白简讯']
    ]
    for (const [re, value, label] of THEMES) {
      if (re.test(msg)) {
        config.theme = value
        Config.set(config)
        invalidateDailyCache()
        await e.reply(`✅ 已切换至主题【${label}】，下次生成日报时生效`)
        return true
      }
    }
    await e.reply('❌ 主题名称错误，可用主题：芙芙蓝色、真寻粉色、霜笺白鹭、绿野青穗、素白简讯。示例：日报主题切换 霜笺白鹭')
    return false
  }

  // ---------- 侧栏话题模块：知乎话题榜 / 哔哩哔哩热搜 二选一 ----------

  async switchZhihu(e) {
    if (!e.isMaster) {
      await e.reply('❌ 仅BOT主人可使用此命令')
      return false
    }
    if (config.sideModule === 'zhihu') {
      await e.reply('当前侧栏已是知乎话题榜，无需切换')
      return true
    }
    config.sideModule = 'zhihu'
    Config.set(config)
    invalidateDailyCache()
    logger.mark('[furina-daily] 侧栏已切换至知乎话题榜')
    await e.reply('✅ 侧栏已切换为知乎话题榜，下次生成日报时生效')
    return true
  }

  async switchBilibili(e) {
    if (!e.isMaster) {
      await e.reply('❌ 仅BOT主人可使用此命令')
      return false
    }
    if (config.sideModule === 'bilibili') {
      await e.reply('当前侧栏已是哔哩哔哩热搜，无需切换')
      return true
    }
    config.sideModule = 'bilibili'
    Config.set(config)
    invalidateDailyCache()
    logger.mark('[furina-daily] 侧栏已切换至哔哩哔哩热搜')
    await e.reply('✅ 侧栏已切换为哔哩哔哩热搜，下次生成日报时生效')
    return true
  }

  // ---------- 图片压缩开关 ----------

  async toggleCompress(e) {
    if (!e.isMaster) {
      await e.reply('❌ 仅BOT主人可使用此命令')
      return false
    }
    const msg = e.msg || e.message || ''
    const arg = (msg.match(/^日报压缩\s*(开|关|on|off)?\s*$/i)?.[1] || '').toLowerCase()
    const current = config.compressImage !== false && config.compressImage !== 'false'
    const enable = arg ? (arg === '开' || arg === 'on') : !current

    config.compressImage = enable
    Config.set(config)
    invalidateDailyCache()
    logger.mark(`[furina-daily] 图片压缩已${enable ? '开启' : '关闭'}`)

    const label = compressFormatLabel(config.compressFormat)
    await e.reply(`✅ 日报图片压缩已${enable ? '开启' : '关闭'}（格式 ${label}），下次生成日报时生效`)
    return true
  }

  // ---------- 日报模拟：读取 resources/mock 的本地示例数据，按全部主题各出一份「模拟日报」，用于预览 ----------

  async mockDaily(e) {
    if (!e.isMaster) {
      await e.reply('❌ 仅BOT主人可使用此命令')
      return false
    }
    // 五套主题一览（值与 THEME_TEMPLATES / 锅巴选项保持一致）
    const MOCK_THEMES = [
      ['blue', '芙芙蓝色'],
      ['pink', '真寻粉色'],
      ['lu', '霜笺白鹭'],
      ['green', '绿野青穗'],
      ['plain', '素白简讯']
    ]
    const status = await getMockStatus()
    const hasData = status.items.filter(i => i.has).length
    if (!hasData) {
      await e.reply('⚠️ 未找到本地示例数据（resources/mock/*.json），无法生成预览日报。')
      return true
    }
    await e.reply(`🔄 正在生成「模拟日报」（本地示例数据 × ${MOCK_THEMES.length} 套主题，约需一分钟）...`)

    // useMock 只读本地数据、不请求网络，也不写入今日缓存，可反复执行用于对比渲染效果；
    // 每套主题独立配置副本：标题固定为「模拟日报」，主题逐一轮换
    let ok = 0
    for (const [theme, label] of MOCK_THEMES) {
      try {
        const mockConfig = { ...config, theme, customTitle: '模拟日报' }
        const imagePath = await generateDaily(mockConfig, {
          useMock: true,
          compress: resolveCompress(mockConfig)
        })
        if (imagePath) {
          ok++
          await e.reply(segment.image(imagePath))
        }
      } catch (err) {
        logger.error(`[furina-daily] 模拟日报（${label}）生成失败: ${err?.message || err}`)
      }
    }

    if (ok > 0) {
      await e.reply(`✅ 模拟日报已完成（${ok}/${MOCK_THEMES.length} 套主题）`)
    } else {
      await e.reply('❌ 预览日报生成失败，请查看日志。')
    }
    return true
  }

  // ---------- 数据源状态 ----------

  async showApiStatus(e) {
    const rows = [
      ['60S 读世界', 'news60s'],
      ['摸鱼日历', 'moyu'],
      ['知乎话题榜', 'zhihu'],
      ['哔哩哔哩热搜', 'bilibili'],
      ['IT 资讯', 'itNews'],
      ['抖音热搜', 'douyin'],
      ['头条热搜', 'toutiao'],
      ['今日新番', 'bangumi']
    ]
    const text = rows.map(([label, key]) => `${label}：${getCurrentBase(config, key)}`).join('\n')
    await e.reply(`🌐 当前数据源\n${text}\n（请求失败会自动切换到内置实例）`)
    return true
  }
}