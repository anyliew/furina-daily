// src/utils/dataStatus.js
// 模块级数据状态登记：供告警机制区分「全部真实数据 / 存在 mock 降级」。
// requestWithFallback 成功 → ok；fetcher 全部数据源失败、落到 mock 兜底 → degraded。
// 生命周期：generateDaily 真实数据生成开始时 resetStats()，结束后 getStats() 读取。

let stats = { ok: [], degraded: [] }

export function resetStats() {
  stats = { ok: [], degraded: [] }
}

export function markModule(name, status, detail = '') {
  if (!name) return
  if (status === 'ok') {
    if (!stats.ok.includes(name)) stats.ok.push(name)
    stats.degraded = stats.degraded.filter(d => d.name !== name)
  } else {
    if (!stats.degraded.some(d => d.name === name)) {
      stats.degraded.push({ name, detail: String(detail || '') })
    }
  }
}

export function getStats() {
  return {
    ok: [...stats.ok],
    degraded: stats.degraded.map(d => ({ ...d })),
    level: stats.degraded.length ? 'degraded' : 'ok'
  }
}
