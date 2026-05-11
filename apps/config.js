import fs from 'fs'
import path from 'path'
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

    try {
      const defMtime = fs.statSync(DEFAULT_CONFIG).mtimeMs
      const userMtime = fs.existsSync(USER_CONFIG) ? fs.statSync(USER_CONFIG).mtimeMs : 0
      if (defMtime > userMtime) {
        logger.mark('[furina-daily] 默认配置已更新，正在自动合并...')
        const def = this._readDefaultConfig()
        const user = this._readUserConfig()
        const merged = deepMerge(def, user)
        fs.writeFileSync(USER_CONFIG, yaml.dump(merged), 'utf8')
        this._config = merged
      }
    } catch (e) {
      logger.error('[furina-daily] 合并配置时出错:', e.message)
    }

    this._startWatch()
    return this._config
  }
}

export default new Config()