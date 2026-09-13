// src/utils/apiBase.js
// 数据源基址解析：每个模块的地址都能单独配置，配置的地址失效时自动回退到内置实例池
//
// 60s 系列 API 的公共实例见 https://docs.60s-api.viki.moe/7306811m0
// 下面 POOLS 里只保留实测过（含 /v2/bili）能通的域名。

const trimSlash = (s) => String(s || '').trim().replace(/\/+$/, '');

/** B站热搜可用实例：主域 60s.viki.moe 的 /v2/bili 长期返回 500，故单独一池 */
const BILI_POOL = [
  'https://60s.7se.cn',
  'https://60s.mizhoubaobei.top',
  'https://60s.crystelf.top',
  'https://api.elysiayanyu.top',
  'https://api.cczo.cc/60s',
  'https://60s.superjeason.qzz.io'
];

/** 60s 系列通用实例：主域优先，其后为实测可用的公共实例 */
const VIKI_POOL = [
  'https://60s.viki.moe',
  'https://60s.7se.cn',
  'https://60s.crystelf.top',
  'https://api.elysiayanyu.top',
  'https://api.cczo.cc/60s'
];

/** 各模块的内置回退池 */
const POOLS = {
  news60s: VIKI_POOL,
  moyu: VIKI_POOL,
  zhihu: VIKI_POOL,
  itNews: VIKI_POOL,
  douyin: VIKI_POOL,
  toutiao: VIKI_POOL,
  bilibili: BILI_POOL,
  bangumi: ['https://api.bgm.tv']
};

/** 模块 -> apiBase 配置键 */
const KEYS = {
  news60s: 'news60s',
  moyu: 'moyu',
  zhihu: 'zhihu',
  itNews: 'itNews',
  douyin: 'douyin',
  toutiao: 'toutiao',
  bilibili: 'bilibili',
  bangumi: 'bangumi'
};

/** 各模块的出厂默认地址（配置里没填、也没成功过时的首选） */
const DEFAULTS = {
  news60s: 'https://60s.viki.moe',
  moyu: 'https://60s.viki.moe',
  zhihu: 'https://60s.viki.moe',
  itNews: 'https://60s.viki.moe',
  douyin: 'https://60s.viki.moe',
  toutiao: 'https://60s.viki.moe',
  bilibili: 'https://60s.7se.cn',
  bangumi: 'https://api.bgm.tv'
};

/** 进程内缓存：模块 -> 最近一次请求成功的地址，避免每次都从第一个开始试 */
const successCache = new Map();

export function listApiModules() {
  return Object.keys(KEYS);
}

export function getDefaultBase(module) {
  return DEFAULTS[module] || DEFAULTS.news60s;
}

export function getPool(module) {
  return POOLS[module] || VIKI_POOL;
}

/**
 * 取某模块的候选基址数组（已去重，按优先级排序）
 * 顺序：用户为该模块单独填的 > 上次成功的 > 通用基址(apiBase.viki) > 内置池
 * @param {object} config 插件配置
 * @param {string} module 模块名，见 KEYS
 */
export function getApiBases(config, module) {
  const custom = trimSlash(config?.apiBase?.[KEYS[module]]);
  const generic = trimSlash(config?.apiBase?.viki);
  const cached = successCache.get(module);
  const list = [];

  if (custom) list.push(custom);
  if (cached) list.push(cached);
  // 新番是独立数据源；B站热搜在主域上已确认 500，两者都不吃 60s 的通用基址
  if (generic && module !== 'bangumi' && module !== 'bilibili') list.push(generic);
  list.push(getDefaultBase(module));
  for (const b of getPool(module)) list.push(trimSlash(b));

  return [...new Set(list.filter(Boolean))];
}

/** 记住某模块本次成功的地址 */
export function rememberBase(module, base) {
  if (base) successCache.set(module, trimSlash(base));
}

/** 取当前实际会用的第一个地址（用于日志/状态展示） */
export function getCurrentBase(config, module) {
  return getApiBases(config, module)[0];
}

/**
 * 依次尝试候选地址，直到某个地址的请求成功
 * @param {object} config 插件配置
 * @param {string} module 模块名
 * @param {(base:string)=>Promise<any>} handler 请求函数，抛错即视为该地址不可用
 * @returns {Promise<any>} handler 的返回值；全部失败则抛出最后一个错误
 */
export async function requestWithFallback(config, module, handler) {
  const bases = getApiBases(config, module);
  let lastErr;
  for (const base of bases) {
    try {
      const result = await handler(base);
      rememberBase(module, base);
      return result;
    } catch (err) {
      lastErr = err;
      globalThis.logger?.debug?.(`[furina-daily] ${module} 数据源 ${base} 请求失败: ${err.message}`);
    }
  }
  throw lastErr || new Error(`${module} 没有可用数据源`);
}
