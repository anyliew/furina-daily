// apps/help.js
import fs from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import puppeteer from 'puppeteer'

const { default: Plugin } = await import('../../../lib/plugins/plugin.js')

let segment
try {
  segment = (await import('icqq')).segment
} catch {
  segment = global.segment || { image: (file) => `[CQ:image,file=${file}]` }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PLUGIN_ROOT = path.resolve(__dirname, '..')
const RESOURCES_DIR = path.join(PLUGIN_ROOT, 'resources')
const TEMP_DIR = path.join(process.cwd(), 'temp', 'daily', 'help')
const CACHE_FILE = path.join(TEMP_DIR, 'help.png')

function ensureDirSync(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function isCacheValid() {
  try {
    const st = await fs.stat(CACHE_FILE)
    const mtime = new Date(st.mtime)
    const mtimeStr = `${mtime.getFullYear()}-${String(mtime.getMonth() + 1).padStart(2, '0')}-${String(mtime.getDate()).padStart(2, '0')}`
    return mtimeStr === todayStr()
  } catch {
    return false
  }
}

async function clearCache() {
  try { await fs.unlink(CACHE_FILE) } catch {}
}

async function loadLogoBase64() {
  const logoPath = path.join(RESOURCES_DIR, 'images', 'furina.png')
  try {
    const buffer = await fs.readFile(logoPath)
    return `data:image/png;base64,${buffer.toString('base64')}`
  } catch {
    return ''
  }
}

function escapeHtml(str) {
  if (!str) return ''
  return str.replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;'
    if (m === '<') return '&lt;'
    if (m === '>') return '&gt;'
    return m
  })
}

async function buildHelpHtml(logoBase64) {
  const now = new Date()
  const formattedTime = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

  const logoImg = logoBase64
    ? `<img src="${logoBase64}" style="height:28px; width:28px; vertical-align:middle; margin-right:8px;">`
    : '📰'

  const modules = [
    {
      name: '基础指令',
      desc: '获取日报及刷新',
      commands: [
        { cmd: '芙芙日报', desc: '手动获取今天的最新日报（智能缓存）' },
        { cmd: '日报', desc: '同上，快捷获取日报' },
        { cmd: '刷新日报', desc: '强制刷新日报，重新抓取最新数据' }
      ]
    },
    {
      name: '订阅管理',
      desc: '控制日报自动推送',
      commands: [
        { cmd: '开启日报推送', desc: '将本群加入每日推送列表' },
        { cmd: '关闭日报推送', desc: '将本群从推送列表中移除' }
      ]
    },
    {
      name: '主题与热搜',
      desc: '切换主题或热搜板块（仅主人）',
      commands: [
        { cmd: '日报主题切换 芙芙蓝色', desc: '使用蓝色默认主题' },
        { cmd: '日报主题切换 真寻粉色', desc: '使用粉色真寻主题' },
        { cmd: '日报切换抖音热搜', desc: '热搜板块切换为抖音热搜' },
        { cmd: '日报切换今日新番', desc: '热搜板块切换为今日新番' }
      ]
    },
    {
      name: '高级指令',
      desc: '帮助、更新与配置',
      commands: [
        { cmd: '日报帮助', desc: '显示本帮助菜单' },
        { cmd: '日报帮助刷新', desc: '强制刷新本帮助图片' },
        { cmd: '日报插件更新', desc: '检查并更新插件（仅主人）' },
        { cmd: '日报清空配置', desc: '备份当前配置并恢复默认设置（仅主人）' }
      ]
    },
    {
      name: '配置说明',
      desc: '可视化配置',
      commands: [
        { cmd: '锅巴面板', desc: '在 Guoba 插件中管理推送群、时间、主题、API 等设置' }
      ]
    }
  ]

  const modulesHtml = modules.map(mod => `
    <div class="module-card">
      <div class="module-header">
        <h3>${escapeHtml(mod.name)}</h3>
        <p>${escapeHtml(mod.desc)}</p>
      </div>
      <div class="command-list">
        ${mod.commands.map(cmd => `
          <div class="command-item">
            <code>${escapeHtml(cmd.cmd)}</code>
            <span>${escapeHtml(cmd.desc)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>芙芙日报 · 帮助菜单</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: #f6f8fa;
    color: #1f2328;
    display: flex;
    justify-content: center;
    padding: 20px;
    -webkit-font-smoothing: antialiased;
  }
  .container {
    width: 600px;
    background: #ffffff;
    border: 1px solid #d0d7de;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .header {
    padding: 16px 20px;
    border-bottom: 1px solid #d0d7de;
    background: #f6f8fa;
  }
  .header h1 {
    font-size: 24px;
    font-weight: 600;
    color: #1f2328;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .content {
    padding: 16px 20px 8px;
  }
  .module-card {
    background: #ffffff;
    border: 1px solid #d0d7de;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
  }
  .module-card:last-child { margin-bottom: 0; }
  .module-header {
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #d8dee4;
  }
  .module-header h3 {
    font-size: 18px;
    font-weight: 600;
    color: #1f2328;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .module-header p {
    font-size: 13px;
    color: #656d76;
  }
  .command-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .command-item {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 10px;
  }
  .command-item code {
    background: #f6f8fa;
    border: 1px solid #d0d7de;
    padding: 3px 10px;
    border-radius: 20px;
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    font-size: 13px;
    font-weight: 600;
    color: #0969da;
    white-space: nowrap;
  }
  .command-item span {
    flex: 1;
    font-size: 13px;
    color: #57606a;
    line-height: 1.5;
  }
  .footer {
    padding: 12px 20px;
    border-top: 1px solid #d0d7de;
    text-align: center;
    font-size: 12px;
    color: #656d76;
    background: #f6f8fa;
    line-height: 1.6;
  }
  h1 img, h3 img {
    vertical-align: middle;
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${logoImg} 芙芙日报</h1>
  </div>
  <div class="content">
    ${modulesHtml}
  </div>
  <div class="footer">
    Created By Yunzai-Bot & furina-daily<br>
    生成时间: ${formattedTime}
  </div>
</div>
</body>
</html>`
}

async function htmlToImageFile(html, outputPath) {
  let browser = null
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: 'new'
    })
    const page = await browser.newPage()
    await page.setViewport({ width: 640, height: 480, deviceScaleFactor: 2 })
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight)
    await page.setViewport({ width: 640, height: bodyHeight + 30, deviceScaleFactor: 2 })
    await page.screenshot({ path: outputPath, type: 'png', fullPage: true })
    return outputPath
  } finally {
    if (browser) await browser.close()
  }
}

let generating = false

export default class furinaHelp extends Plugin {
  constructor() {
    super({
      name: '[furina-daily] 芙芙日报帮助',
      dsc: '日报帮助 / 日报帮助刷新',
      event: 'message',
      priority: 100,
      rule: [
        { reg: /^日报帮助$/i, fnc: 'showHelp' },
        { reg: /^日报帮助刷新$/i, fnc: 'refreshHelp' }
      ]
    })
  }

  async showHelp(e) {
    if (generating) {
      await this.reply('⏳ 正在生成帮助图片，请稍后再试...')
      return false
    }
    generating = true
    try {
      ensureDirSync(TEMP_DIR)
      let imagePath
      if (await isCacheValid()) {
        imagePath = CACHE_FILE
      } else {
        const logoBase64 = await loadLogoBase64()
        const html = await buildHelpHtml(logoBase64)
        imagePath = await htmlToImageFile(html, CACHE_FILE)
      }
      await this.reply(segment.image(imagePath))
    } catch (err) {
      logger.error(`[furina-daily] 帮助生成失败: ${err}`)
      await this.reply('❌ 生成帮助菜单失败')
    } finally {
      generating = false
    }
    return true
  }

  async refreshHelp(e) {
    if (generating) {
      await this.reply('⏳ 正在刷新帮助图片，请稍后再试...')
      return false
    }
    generating = true
    try {
      await clearCache()
      ensureDirSync(TEMP_DIR)
      const logoBase64 = await loadLogoBase64()
      const html = await buildHelpHtml(logoBase64)
      const imagePath = await htmlToImageFile(html, CACHE_FILE)
      await this.reply(segment.image(imagePath))
      await this.reply('✅ 帮助菜单已刷新', true)
    } catch (err) {
      logger.error(`[furina-daily] 刷新帮助失败: ${err}`)
      await this.reply('❌ 刷新帮助失败')
    } finally {
      generating = false
    }
    return true
  }
}