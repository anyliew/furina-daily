// src/utils/notify.js
// 主人私聊告警：合并转发（摘要 + 错误关键行）发给全部主人。
// 实现对齐 git-plugin/core/errorNotify.js 的真机验证方案：
//   ① 主人来源：Yunzai cfg（lib/config/config.js）的 masterQQ / master 映射，Bot.cfg / Bot.master 兜底
//   ② 发送：Bot.pickFriend(uin).sendMsg，合并转发失败降级纯文本单条
//   ③ 转发节点同时带 message 与 content 字段，兼容框架 makeForwardMsg 与 OneBot v11 标准 node
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

// Yunzai 配置模块懒加载（主人信息的权威来源）；非 Yunzai 环境 / 加载失败时降级到 Bot 属性。
// 测试注入点：globalThis.__furinaDailyYunzaiCfg 提供同结构对象（本机加载真实 cfg 会因文件监听被沙箱终止）
let cfgPromise = null
function loadYunzaiCfg() {
  if (cfgPromise) return cfgPromise
  if (globalThis.__furinaDailyYunzaiCfg) {
    cfgPromise = Promise.resolve(globalThis.__furinaDailyYunzaiCfg)
    return cfgPromise
  }
  cfgPromise = import('../../../lib/config/config.js')
    .then(m => m.default || m)
    .catch(e => {
      globalThis.logger?.debug?.(`${TAG} Yunzai cfg 加载失败，降级到 Bot 主人信息: ${e.message}`)
      return null
    })
  return cfgPromise
}

function pushMaster(out, v) {
  if (v == null) return
  // masterQQ 可能含 "stdin" 这类非 QQ 占位值，只取 5-11 位数字
  const m = String(v).match(/\d{5,11}/)
  if (m && !out.includes(m[0])) out.push(m[0])
}

/** 取主人 QQ 列表（去重），优先级：cfg.masterQQ > cfg.master 映射 > Bot.cfg / Bot.master */
async function getMasters() {
  const out = []
  try {
    const cfg = await loadYunzaiCfg()
    for (const v of cfg?.masterQQ || []) pushMaster(out, v)
    const master = cfg?.master
    if (master && typeof master === 'object' && !Array.isArray(master)) {
      for (const list of Object.values(master)) for (const v of list || []) pushMaster(out, v)
    } else if (Array.isArray(master)) {
      for (const v of master) pushMaster(out, v)
    }
  } catch (e) {
    globalThis.logger?.debug?.(`${TAG} 读取 cfg 主人失败: ${e.message}`)
  }
  try {
    // 注意：TRSS-Yunzai 的 Bot 门面没有 master 属性，这里只是协议端自行挂载时的兜底
    for (const v of globalThis.Bot?.master || globalThis.Bot?.cfg?.master || []) pushMaster(out, v)
  } catch {}
  return out
}

/** 错误指纹：同一问题（级别+来源+详情前 120 字）共用一个冷却 key */
function fingerprint({ level, source, message }) {
  return `${level}|${source}|${clip(message, 120)}`.replace(/\s+/g, ' ')
}

/** 构造转发节点：message + content 双字段，兼容框架 makeForwardMsg 与 OneBot v11 标准 node */
function buildNodes(texts) {
  const uid = Array.isArray(globalThis.Bot?.uin) ? globalThis.Bot.uin[0] : (globalThis.Bot?.uin || 10000)
  return texts.map(t => ({
    nickname: '芙芙心日报',
    user_id: uid,
    message: t,
    content: [{ type: 'text', data: { text: t } }]
  }))
}

/** 纯文本降级：转发构造失败时退化为带分隔线的单条文本 */
function plainTextFallback(texts) {
  return texts.join('\n—————————\n')
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
    if (typeof globalThis.Bot?.pickFriend !== 'function') {
      globalThis.logger?.error?.(`${TAG} Bot 未就绪，告警仅记录日志: ${clip(message, 200)}`)
      return false
    }

    const masters = await getMasters()
    if (!masters.length) {
      globalThis.logger?.error?.(`${TAG} 未找到主人配置（config/config/other.yaml 的 masterQQ），告警仅记录日志: ${clip(message, 200)}`)
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

    const logText = [
      ...(stack ? String(stack).split('\n').slice(-50) : []),
      '─────────────',
      '完整日志见服务器 logs/error.log'
    ].join('\n')

    let ok = false
    for (const uin of masters) {
      // ① 首选合并转发
      try {
        const forward = globalThis.Bot.makeForwardMsg(buildNodes([summary, logText]))
        await globalThis.Bot.pickFriend(uin).sendMsg(forward)
        ok = true
        globalThis.logger?.info?.(`${TAG} 已向主人 ${uin} 推送告警（合并转发，${levelLabel}）`)
        continue
      } catch (e) {
        globalThis.logger?.warn?.(`${TAG} 主人 ${uin} 合并转发失败（${e.message}），降级为纯文本单条`)
      }
      // ② 降级：纯文本单条
      try {
        await globalThis.Bot.pickFriend(uin).sendMsg(plainTextFallback([summary, logText]))
        ok = true
        globalThis.logger?.info?.(`${TAG} 已向主人 ${uin} 推送告警（纯文本，${levelLabel}）`)
      } catch (e) {
        globalThis.logger?.error?.(`${TAG} 私聊主人 ${uin} 失败（转发与纯文本均失败）: ${e.message}`)
      }
    }
    if (ok) globalThis.logger?.mark?.(`${TAG} 告警已私聊 ${masters.length} 位主人（${levelLabel}）`)
    return ok
  } catch (e) {
    // 通知逻辑自身的兜底：绝不让告警把主流程炸第二次
    globalThis.logger?.error?.(`${TAG} 告警流程异常: ${e.message}`)
    return false
  }
}
