// guoba/configInfo.js
import { schemas } from './schemas/index.js'
import Config from '../apps/config.js'

/** 所有可在锅巴表单里配置的数据源基址子项（与 schema 中的 apiBase.* 字段一一对应） */
const API_BASE_FIELDS = [
  'viki', 'news60s', 'moyu', 'zhihu', 'itNews', 'douyin', 'toutiao', 'bilibili', 'bangumi'
]

/** 各 apiBase 子项的出厂默认（仅用于 getConfigData 回显，避免表单输入框为空） */
const API_BASE_DEFAULTS = {
  viki: 'https://60s.viki.moe',
  news60s: '',
  moyu: '',
  zhihu: '',
  itNews: '',
  douyin: '',
  toutiao: '',
  bilibili: 'https://60s.7se.cn',
  bangumi: 'https://api.bgm.tv'
}

export default {
  schemas,
  getConfigData() {
    const config = Config.get()
    const apiBase = config.apiBase || {}
    const data = {
      reportGroup: Array.isArray(config.reportGroup) ? config.reportGroup : [],
      morningTime: config.morningTime || '0 10 * * *',
      eveningTime: config.eveningTime || '0 22 * * *',
      customTitle: config.customTitle || '芙芙心日报',
      logoImage: config.logoImage || 'logo.png',
      logoSize: config.logoSize || '',
      titleFont: config.titleFont || 'Title.ttf',
      titleFontSize: config.titleFontSize || '',
      secondaryTitleFont: config.secondaryTitleFont || 'Secondary_Title.ttf',
      secondaryTitleFontSize: config.secondaryTitleFontSize || '',
      contentFont: config.contentFont || 'Content.ttf',
      contentFontSize: config.contentFontSize || '',
      hotModule: config.hotModule || 'douyin',
      sideModule: config.sideModule || 'zhihu',
      renderScale: config.renderScale || 1,
      compressImage: config.compressImage !== false && config.compressImage !== 'false',
      compressFormat: config.compressFormat || 'png',
      compressQuality: config.compressQuality || 80,
      theme: config.theme || 'blue',
      autoMerge: config.autoMerge !== false
    }
    const proxy = config.proxy || {}
    data['proxy.bangumi'] = proxy.bangumi || ''
    for (const k of API_BASE_FIELDS) {
      const v = apiBase[k]
      data[`apiBase.${k}`] = (v == null || v === '') ? API_BASE_DEFAULTS[k] : v
    }
    return data
  },
  async setConfigData(data, { Result }) {
    try {
      const current = Config.get()
      current.reportGroup = Array.isArray(data.reportGroup) ? data.reportGroup : current.reportGroup
      current.morningTime = data.morningTime || '0 10 * * *'
      current.eveningTime = data.eveningTime || '0 22 * * *'
      current.customTitle = data.customTitle || '芙芙心日报'
      current.logoImage = data.logoImage || 'logo.png'
      current.logoSize = data.logoSize || ''
      current.titleFont = data.titleFont || 'Title.ttf'
      current.titleFontSize = data.titleFontSize || ''
      current.secondaryTitleFont = data.secondaryTitleFont || 'Secondary_Title.ttf'
      current.secondaryTitleFontSize = data.secondaryTitleFontSize || ''
      current.contentFont = data.contentFont || 'Content.ttf'
      current.contentFontSize = data.contentFontSize || ''
      current.hotModule = data.hotModule || 'douyin'
      current.sideModule = data.sideModule || 'zhihu'
      current.renderScale = Number(data.renderScale) || 1
      current.compressImage = data.compressImage ?? true
      current.compressFormat = data.compressFormat || 'png'
      current.compressQuality = Number(data.compressQuality) || 80
      current.theme = data.theme || 'blue'
      current.autoMerge = data.autoMerge ?? true

      // apiBase：保留已存在的其它子项，只覆盖表单里出现的字段（关键修复：
      // 旧代码用 current.apiBase = { bangumi, viki } 整体替换，会把其它子项全部清空）
      current.apiBase = {
        ...(current.apiBase || {}),
        viki: data['apiBase.viki'] || 'https://60s.viki.moe',
        news60s: data['apiBase.news60s'] || '',
        moyu: data['apiBase.moyu'] || '',
        zhihu: data['apiBase.zhihu'] || '',
        itNews: data['apiBase.itNews'] || '',
        douyin: data['apiBase.douyin'] || '',
        toutiao: data['apiBase.toutiao'] || '',
        bilibili: data['apiBase.bilibili'] || 'https://60s.7se.cn',
        bangumi: data['apiBase.bangumi'] || 'https://api.bgm.tv'
      }

      // 代理前缀：同样只覆盖表单字段，保留已存在的其它子项
      current.proxy = {
        ...(current.proxy || {}),
        bangumi: data['proxy.bangumi'] || ''
      }

      Config.set(current)
      return Result.ok({}, '✅ 芙芙日报配置已保存！')
    } catch (error) {
      console.error('[furina-daily] 锅巴配置保存失败:', error)
      return Result.error({}, '❌ 保存失败，请检查日志。')
    }
  }
}
