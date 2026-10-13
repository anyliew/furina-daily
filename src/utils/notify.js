// src/utils/notify.js
// 主人私聊告警：合并转发（摘要 + 错误关键行）发给全部主人。
// 三条铁律：
//   1. error.log 是事实记录（logger.error 照旧），本模块只是主动告警的额外通道
//   2. 冷却去重：同一指纹（级别+来源+详情）在冷却期内不重复打扰
//   3. 本模块自身绝不抛错——通知失败只记日志，绝不能把主流程炸第二次

const TAG = '[furina-daily]'

/** 冷却时长（秒）：致命 10 分钟、降级 2 小时 */
const COOLDOWN = { fatal: 600, degraded: 7200 }

const clip = (s, n) => {
  s = String(s || '')
  return s.length > n ? s.slice(0, n) + '…' : s
}

/** 取主人 QQ 列表（兼容 Bot.master 为数组或单值） */
function getMasters() {
  const m = globalThis.Bot?.master
  if (Array.isArray(m)) return m.filter(Boolean)
  if (m) return [m]
  return []
}

/** 错误指纹：同一问题（级别+来源+详情前 120 字）共用一个冷却 key */
function fingerprint({ level, source, message }) {
  return `${level}|${source}|${clip(message, 120)}`.replace(/\s+/g, ' ')
}

/** 构造合并转发消息；makeForwardMsg 不可用时返回 null（调用方降级为纯文本） */
async function makeForwardNodes(bot, nodes) {
  if (typeof bot?.makeForwardMsg !== 'function') return null
  try {
    return await bot.makeForwardMsg(nodes)
  } catch (e) {
    globalThis.logger?.debug?.(`${TAG} 构造合并转发失败，降级为纯文本: ${e.message}`)
    return null
  }
}

/**
 * 发送告警给全部主人
 * @param {object} opts
 * @param {'fatal'|'degraded'} opts.level 级别：致命 / 降级
 * @param {string} opts.source 触发来源，如「定时任务 07:30」「命令触发（群 859379803）」
 * @param {string} opts.message 一句话描述（进摘要节点）
 * @param {string} [opts.stack] 错误堆栈（进日志节点，只取最后 50 行）
 * @param {string[]} [opts.extraLines] 附加关键行（如各模块降级原因）
 * @returns {Promise<boolean>} 是否至少成功送达一位主人
 */
export async function notifyMaster({ level = 'fatal', source = '未知', message = '', stack = '', extraLines = [] } = {}) {
  try {
    const masters = getMasters()
    if (!masters.length) {
      globalThis.logger?.warn?.(`${TAG} 未配置主人 QQ，告警仅写入日志: ${clip(message, 200)}`)
      return false
    }

    // 冷却检查（redis 不可用时视为无冷却，宁可多发不漏发）
    const key = `Yz:furina-daily:notify:${fingerprint({ level, source, message })}`
    const redis = globalThis.redis
    if (redis && typeof redis.get === 'function') {
      try {
        if (await redis.get(key)) {
          globalThis.logger?.debug?.(`${TAG} 告警冷却中，跳过私聊: ${clip(message, 100)}`)
          return true
        }
        await redis.set(key, '1', { EX: COOLDOWN[level] || 600 })
      } catch (e) {
        globalThis.logger?.debug?.(`${TAG} 告警冷却检查失败（不影响发送）: ${e.message}`)
      }
    }

    const time = new Date().toLocaleString('zh-CN', { hour12: false })
    const levelLabel = level === 'fatal' ? '🔴 致命' : '🟡 降级'
    const summary = [
      '⚠️ 芙芙日报告警',
      '─────────────',
      `级别：${levelLabel}`,
      `来源：${source}`,
      message ? `详情：${clip(message, 500)}` : '',
      `时间：${time}`,
      ...(extraLines.length ? ['─────────────', ...extraLines.slice(0, 10).map(l => clip(l, 300))] : [])
    ].filter(Boolean).join('\n')

    const nodeOf = (text) => ({
      nickname: '芙芙心日报',
      user_id: Array.isArray(globalThis.Bot?.uin) ? globalThis.Bot.uin[0] : (globalThis.Bot?.uin || 10000),
      message: text
    })

    const logText = [
      ...(stack ? String(stack).split('\n').slice(-50) : []),
      '─────────────',
      '完整日志见服务器 logs/error.log'
    ].join('\n')

    const forward = await makeForwardNodes(globalThis.Bot, [nodeOf(summary), nodeOf(logText)])
    const payload = forward || clip(`${summary}\n${logText}`, 3500)

    let sent = 0
    for (const uin of masters) {
      try {
        await globalThis.Bot.pickUser(uin).sendMsg(payload)
        sent++
      } catch (e) {
        globalThis.logger?.error?.(`${TAG} 告警私聊发送失败（${uin}）: ${e.message}`)
      }
    }
    globalThis.logger?.mark?.(`${TAG} 告警已私聊 ${sent}/${masters.length} 位主人（${levelLabel}）`)
    return sent > 0
  } catch (e) {
    // 通知逻辑自身的兜底：绝不让告警把主流程炸第二次
    globalThis.logger?.error?.(`${TAG} 告警流程异常: ${e.message}`)
    return false
  }
}
