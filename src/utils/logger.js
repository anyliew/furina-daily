// src/utils/logger.js
// 统一日志输出，优先使用 Yunzai 全局 logger，否则回退到 console

const log = global.logger || {
  mark: (msg) => console.log(`[MARK] ${msg}`),
  info: (msg) => console.log(`[INFO] ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`),
  debug: (msg) => console.debug(`[DEBUG] ${msg}`),
};

export function logSuccess(source, count = null) {
  const msg = count !== null ? `✅ ${source} 获取成功，共 ${count} 条` : `✅ ${source} 获取成功`;
  log.mark(msg);
}

export function logFailure(source, useMock = true) {
  log.warn(`⚠️ ${source} 获取失败，${useMock ? '使用模拟数据' : '跳过'}`);
}