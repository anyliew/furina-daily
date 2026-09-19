// src/utils/logger.js
// 统一日志输出，优先使用 Yunzai 全局 logger，否则回退到 console。
// 全部带 [furina-daily] 前缀，控制台过滤/阅读都方便。

const TAG = '[furina-daily]'
const log = global.logger || {
  mark: (msg) => console.log(msg),
  info: (msg) => console.log(msg),
  warn: (msg) => console.warn(msg),
  error: (msg) => console.error(msg),
  debug: (msg) => console.debug(msg),
};

export function logMark(msg) {
  log.mark(`${TAG} ${msg}`);
}

export function logSuccess(source, count = null) {
  const msg = count !== null ? `✅ ${source} 获取成功，共 ${count} 条` : `✅ ${source} 获取成功`;
  logMark(msg);
}

export function logFailure(source, useMock = true) {
  log.warn(`${TAG} ⚠️ ${source} 获取失败，${useMock ? '使用模拟数据' : '跳过'}`);
}