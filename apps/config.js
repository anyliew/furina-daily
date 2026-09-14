import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import yaml from 'js-yaml'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// 插件根目录（config.js 在 apps/ 下，所以向上两级）
const pluginRoot = path.resolve(__dirname, '..')

const DEFAULT_CONFIG = path.join(pluginRoot, 'config', 'default_config', 'daily.yaml')
const USER_CONFIG = path.join(pluginRoot, 'config', 'config', 'daily.yaml')

function deepMerge(def, user) {
  const result = { ...def }
  for (const key of Object.keys(user)) {
    if (!result.hasOwnProperty(key)) continue
    const defVal = result[key]
    const userVal = user[key]
    if (
      typeof defVal === 'object' && defVal !== null && !Array.isArray(defVal) &&
      typeof userVal === 'object' && userVal !== null && !Array.isArray(userVal)
    ) {
      result[key] = deepMerge(defVal, userVal)
    } else {
      result[key] = userVal
    }
  }
  return result
}

class Config {
  constructor() {
    this._config = null
    this._watchers = []
    this._callbacks = []
  }

  _readDefaultConfig() {
    const raw = fs.readFileSync(DEFAULT_CONFIG, 'utf8')
    return yaml.load(raw) || {}
  }

  _readUserConfig() {
    try {
      const raw = fs.readFileSync(USER_CONFIG, 'utf8')
      return yaml.load(raw) || {}
    } catch {
      return {}
    }
  }

  _readAndMerge() {
    const def = this._readDefaultConfig()
    const user = this._readUserConfig()
    return deepMerge(def, user)
  }

  /**
   * 只把 source 中「target 没有」的键补进 target，绝不覆盖用户已有值；
   * 遇到两边都是普通对象则递归。用于把默认配置的新增字段合并进用户配置。
   * （参考 yenai-plugin 的 mergeCfg：仅注入缺字段，不破坏用户自定义值）
   */
  _mergeNewKeys(target, source) {
    for (const key of Object.keys(source)) {
      const sVal = source[key]
      if (!Object.prototype.hasOwnProperty.call(target, key)) {
        target[key] = sVal
      } else if (
        sVal && typeof sVal === 'object' && !Array.isArray(sVal) &&
        target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
      ) {
        this._mergeNewKeys(target[key], sVal)
      }
    }
    return target
  }

  /** 找出用户配置中存在、但默认配置已移除的字段（可能已废弃），递归返回完整路径 */
  _findDeprecated(target, source, prefix = '') {
    const deprecated = []
    for (const key of Object.keys(target)) {
      const tVal = target[key]
      const fullKey = prefix ? `${prefix}.${key}` : key
      if (!Object.prototype.hasOwnProperty.call(source, key)) {
        deprecated.push(fullKey)
      } else if (
        tVal && typeof tVal === 'object' && !Array.isArray(tVal) &&
        source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
      ) {
        deprecated.push(...this._findDeprecated(tVal, source[key], fullKey))
      }
    }
    return deprecated
  }

  _startWatch() {
    this._stopWatch()
    const debounce = (func, delay) => {
      let timer
      return (...args) => {
        clearTimeout(timer)
        timer = setTimeout(() => func(...args), delay)
      }
    }
    const onChange = debounce(() => {
      logger.mark('[furina-daily] 检测到配置文件变更，重新加载配置')
      this._config = this._readAndMerge()
      this._callbacks.forEach(fn => fn(this._config))
    }, 300)

    if (fs.existsSync(DEFAULT_CONFIG)) {
      this._watchers.push(fs.watch(DEFAULT_CONFIG, (event) => {
        if (event === 'change') onChange()
      }))
    }
    if (fs.existsSync(USER_CONFIG)) {
      this._watchers.push(fs.watch(USER_CONFIG, (event) => {
        if (event === 'change') onChange()
      }))
    }
  }

  _stopWatch() {
    this._watchers.forEach(w => w.close())
    this._watchers = []
  }

  get() {
    if (!this._config) {
      this._config = this._readAndMerge()
    }
    return this._config
  }

  set(data) {
    const current = this.get()
    const merged = deepMerge(current, data)
    fs.writeFileSync(USER_CONFIG, yaml.dump(merged), 'utf8')
    logger.mark('[furina-daily] 配置已保存')
    this._config = merged
  }

  onChange(callback) {
    this._callbacks.push(callback)
  }

  init() {
    const userDir = path.dirname(USER_CONFIG)
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true })
    }
    if (!fs.existsSync(USER_CONFIG)) {
      fs.copyFileSync(DEFAULT_CONFIG, USER_CONFIG)
      logger.mark('[furina-daily] 已生成用户配置文件')
    }

    this._config = this._readAndMerge()

    // 检测默认配置是否更新，自动合并新增字段到用户配置
    // （参考 yenai-plugin 的 mergeCfg：用默认配置内容的 hash 作为是否变动的标记，
    //  仅把默认里「用户没有」的字段补进用户配置，绝不覆盖用户已设置的值）
    try {
      const defRaw = fs.readFileSync(DEFAULT_CONFIG, 'utf8')
      const defHash = crypto.createHash('sha256').update(defRaw).digest('hex')
      const markPath = path.join(userDir, '.furina_merge_marker')
      let storedHash = ''
      try { storedHash = fs.readFileSync(markPath, 'utf8').trim() } catch {}

      if (defHash !== storedHash) {
        const def = yaml.load(defRaw) || {}
        const userCfg = this._readUserConfig()
        // autoMerge 以「用户配置」为准（可在锅巴面板里开关），未设置时回退默认配置的值
        const autoMergeEnabled = (userCfg.autoMerge ?? def.autoMerge) !== false
        if (autoMergeEnabled) {
          const before = JSON.stringify(userCfg)
          this._mergeNewKeys(userCfg, def)
          const after = JSON.stringify(userCfg)
          const deprecated = this._findDeprecated(userCfg, def)
          if (after !== before) {
            fs.writeFileSync(USER_CONFIG, yaml.dump(userCfg), 'utf8')
            logger.mark('[furina-daily] 检测到默认配置更新，已自动合并新增字段到用户配置')
          }
          if (deprecated.length) {
            logger.warn(`[furina-daily] 用户配置中存在默认配置已移除的字段（建议清理）：${deprecated.join(', ')}`)
          }
          // 仅在真正执行过比对/合并时落标记，保证幂等；
          // 若关闭了 autoMerge 则不落标记，之后重新开启时仍能补上这次的新增字段
          fs.writeFileSync(markPath, defHash, 'utf8')
        }
      }
    } catch (e) {
      logger.error('[furina-daily] 合并默认配置时出错:', e.message)
    }

    this._startWatch()
    return this._config
  }
}

export default new Config()