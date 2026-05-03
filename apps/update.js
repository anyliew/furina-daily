// apps/update.js
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const { default: Plugin } = await import('../../../lib/plugins/plugin.js')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PLUGIN_ROOT = path.resolve(__dirname, '..')

let updating = false

export default class furinaUpdate extends Plugin {
  constructor() {
    super({
      name: '[furina-daily] 芙芙日报更新',
      dsc: '日报插件更新',
      event: 'message',
      priority: -Infinity,
      rule: [
        { reg: /^日报插件更新$/i, fnc: 'doUpdate' }
      ]
    })
  }

  async doUpdate(e) {
    if (!e.isMaster) {
      await e.reply('❌ 仅BOT主人可使用此命令')
      return false
    }
    if (updating) {
      await e.reply('⏳ 正在更新中，请稍后再试')
      return false
    }
    updating = true
    const messages = []

    try {
      const exists = await fs.access(PLUGIN_ROOT).then(() => true).catch(() => false)
      if (!exists) {
        await e.reply('未找到插件目录')
        return false
      }

      logger.mark('[furina-daily] 开始插件更新')
      const ret = await Bot.exec('git pull', { cwd: PLUGIN_ROOT })

      if (ret.error) {
        messages.push(`更新失败：${ret.error.message}`)
        await this.sendAll(messages, e)
        return false
      }

      const isUpToDate = /Already up|已经是最新/.test(ret.stdout)
      if (isUpToDate) {
        const time = await this.getLastCommitTime()
        messages.push(`☁️ 日报插件已是最新\n最后更新：${time}`)
        await this.sendAll(messages, e)
        return false
      }

      // 有更新
      const time = await this.getLastCommitTime()
      messages.push(`✅ 日报插件更新成功`)
      messages.push(`🕒 更新时间：${time}`)
      if (/package\.json/.test(ret.stdout)) {
        messages.push('⚠️ 检测到 package.json 变更，请手动执行 pnpm install（或重启后自动安装）')
      }
      messages.push('🔁 可能需要重启机器人以完全应用更新')
      await this.sendAll(messages, e)

    } catch (err) {
      logger.error(`[furina-daily] 更新异常: ${err}`)
      await e.reply(`更新出错：${err.message}`)
    } finally {
      updating = false
    }
    return true
  }

  async getLastCommitTime() {
    try {
      const ret = await Bot.exec('git log -1 --pretty=%cd --date=format:"%F %T"', { cwd: PLUGIN_ROOT })
      return ret.stdout.trim()
    } catch {
      return '未知'
    }
  }

  async sendAll(msgs, e) {
    const fullText = msgs.join('\n\n')
    // 尝试合并转发
    if (e.group && typeof e.group.makeForwardMsg === 'function') {
      try {
        const botInfo = e.bot || {}
        const forwards = msgs.map(msg => ({
          user_id: botInfo.uin || e.self_id || 10000,
          nickname: botInfo.nickname || '芙芙酱',
          message: msg
        }))
        const forward = await e.group.makeForwardMsg(forwards)
        await e.reply(forward)
        return
      } catch (err) {
        logger.error('[furina-daily] 合并转发失败，降级为文本')
      }
    }
    await e.reply(fullText)
  }
}