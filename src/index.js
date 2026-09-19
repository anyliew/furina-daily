// src/index.js - 通过 Yunzai 渲染后端生成日报
// 兼容 TRSS-Yunzai v3.1.x 的新渲染器体系（puppeteer / shotium / 未来的后端），
// 不再依赖单一后端的私有属性（如 renderer.browser）
import fs from 'fs/promises';
import nunjucks from 'nunjucks';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import sharp from 'sharp';
import { fetchAllData, fetchAllMockData, resolveSideModule } from './dataFetcher.js';
import { fetchDouyinHot } from './fetchers/douyin.js';
import { fetchToutiao } from './fetchers/toutiao.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESOURCES_DIR = path.join(__dirname, '../resources');
const TEMPLATES_DIR = path.join(RESOURCES_DIR, 'html');
const TEMP_HTML_PATH = path.join(TEMPLATES_DIR, 'daily.html');
/** 传给渲染后端的模板名 */
const RENDER_NAME = 'furina-daily';
/** 布局宽度：body 内容 1360 + 左右 padding 24×2，与旧版 1440 视窗下的实际排版一致 */
const LAYOUT_WIDTH = 1408;

/**
 * 压缩格式表：两种均为无损画质（像素级与渲染结果一致）
 *  - png           ：PNG 最大 deflate 压缩，兼容性最好
 *  - webp-lossless ：WebP 无损，体积比 PNG 再小约 30-40%
 * 历史遗留：png-none（原图直出）已移除——「关闭压缩开关」即等价旧行为
 */
const COMPRESS_FORMATS = {
  png: { ext: '.png', label: 'PNG（无损）', apply: p => p.png({ compressionLevel: 9, adaptiveFiltering: true }) },
  'webp-lossless': { ext: '.webp', label: 'WebP（无损）', apply: p => p.webp({ lossless: true }) }
};

/** 格式归一化：仅 png / webp-lossless 有效；历史配置里的 png-none / jpeg / jpg / webp 静默回退为 png */
function normalizeFormat(format) {
  const f = String(format || 'png').toLowerCase();
  return (f === 'png' || f === 'webp-lossless') ? f : 'png';
}

/** 取压缩格式的中文名，用于日志与指令回显 */
export function compressFormatLabel(format) {
  return COMPRESS_FORMATS[normalizeFormat(format)].label;
}

/** 按字体文件扩展名推断 @font-face 的 format 提示（.otf 为 CFF 轮廓 → opentype，其余按 truetype） */
function fontFormat(fontFile) {
  return String(fontFile).toLowerCase().endsWith('.otf') ? 'opentype' : 'truetype';
}

nunjucks.configure(TEMPLATES_DIR, { autoescape: true });

/** 统一日志前缀：控制台所有输出都以 [furina-daily] 开头，方便过滤与阅读；优先走 Yunzai logger 保留级别标签 */
const TAG = '[furina-daily]';
const yzLog = global.logger || console;
const log = (...args) => (yzLog.mark ? yzLog.mark(TAG, ...args) : console.log(TAG, ...args));
const logWarn = (...args) => (yzLog.warn ? yzLog.warn(TAG, ...args) : console.warn(TAG, ...args));
const logError = (...args) => (yzLog.error ? yzLog.error(TAG, ...args) : console.error(TAG, ...args));

export async function closeBrowser() {
  log('🔒 浏览器/渲染引擎由框架统一管理，无需关闭');
}

// ---------------------------------------------------------------------------
// 渲染后端适配
// ---------------------------------------------------------------------------

let renderRoot = null;

/**
 * 获取框架的渲染根节点
 *  - v3.1.x：lib/renderer/loader.js，导出的是 RendererLoader 实例（未指定后端时自动选择）
 *  - 旧版：lib/puppeteer/puppeteer.js，导出的是 puppeteer 渲染器实例
 */
async function getRenderRoot() {
  if (renderRoot) return renderRoot;
  for (const mod of ['../../../lib/renderer/loader.js', '../../../lib/puppeteer/puppeteer.js']) {
    try {
      const root = (await import(mod)).default;
      if (root) {
        renderRoot = root;
        return root;
      }
    } catch {
      /* 继续尝试下一个 */
    }
  }
  throw new Error('未找到 Yunzai 渲染后端');
}

/**
 * 候选渲染后端列表，顺序与框架自身的选取规则保持一致：
 * 模板里有 <script> 时，优先交给支持脚本执行的后端（puppeteer），否则优先无进程后端（shotium）；
 * 未被选中的后端仍作为回退候选排在后面
 */
function candidateRenderers(html) {
  const root = renderRoot;
  const all = root?.renderers instanceof Map ? [...root.renderers.values()] : [root];
  if (!(root?.renderers instanceof Map)) return all.filter(Boolean);

  const ordered = (html.includes('</script>') ? root.script_renderers : root.noscript_renderers) || [];
  const list = [...new Set([...ordered, ...all])].filter(Boolean);
  return list.length ? list : all.filter(Boolean);
}

/** 浏览器实例是否可用（puppeteer v22 起 isConnected() 被 connected 属性取代） */
function isAlive(browser) {
  if (!browser) return false;
  if (typeof browser.isConnected === 'function') return browser.isConnected() !== false;
  return browser.connected !== false;
}

/**
 * 兜底：尝试从后端拿一个可用的浏览器实例
 * shotium 这类 "裁掉 CDP/V8 会话" 的后端没有浏览器实例，返回 null
 */
async function getBrowser(rendererObj) {
  if (!rendererObj || rendererObj.id === 'shotium') return null;
  try {
    if (typeof rendererObj.browserInit === 'function') {
      const b = await rendererObj.browserInit();
      if (isAlive(b)) return b;
    }
    if (isAlive(rendererObj.browser)) return rendererObj.browser;
  } catch (err) {
    logWarn(`⏳ 获取 ${rendererObj.id} 浏览器实例失败: ${err.message}`);
  }
  return null;
}

/** 清理 Renderer 对该临时模板的缓存与监听，避免内容缓存不更新 / 缓存泄漏 */
function clearTplCache(tplFile) {
  const R = globalThis.Renderer;
  if (!R) return;
  for (const key of [tplFile, tplFile.replace(/\//g, '\\'), tplFile.replace(/\\/g, '/')]) {
    if (R.html && Object.prototype.hasOwnProperty.call(R.html, key)) delete R.html[key];
    const watcher = R.watcher && R.watcher[key];
    if (watcher) {
      // 临时文件随即删除，给 watcher 挂上空错误监听，避免 chokidar 的 error 事件变成未捕获异常
      watcher.on?.('error', () => {});
      watcher.close?.();
      delete R.watcher[key];
    }
  }
}

/** 按压缩格式修正输出文件扩展名，避免出现内容是 jpeg 却叫 .png 的文件 */
function withFormatExt(outputPath, format) {
  const ext = path.extname(outputPath).toLowerCase();
  const wanted = COMPRESS_FORMATS[normalizeFormat(format)].ext;
  if (ext === wanted) return outputPath;
  return outputPath.slice(0, outputPath.length - ext.length) + wanted;
}

/**
 * 写出图片，按配置决定是否压缩
 * @param {Buffer} buffer 渲染后端返回的原始图片
 * @param {string} outputPath 输出路径
 * @param {object} compress { enabled, format, quality }
 * @returns {Promise<string>} 实际写入的路径（扩展名可能与传入不同）
 */
const fmtMB = b => (b / 1024 / 1024).toFixed(2) + 'MB';

async function saveImage(buffer, outputPath, compress = {}) {
  const raw = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const format = normalizeFormat(compress.format);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  // 直通模式：仅当压缩开关关闭时——渲染后端返回的 PNG 已是编码成品，
  // 直接落盘即可，任何重编码都只会更大（level 0 = 裸存储，58MB 事故的来源）。
  // 直通写入的永远是 PNG，扩展名一律 .png
  if (compress.enabled === false) {
    const target = withFormatExt(outputPath, 'png');
    await fs.writeFile(target, raw);
    log(`✅ 图片已生成（压缩已关闭，原图直出）: ${target} | ${fmtMB(raw.length)}`);
    return target;
  }

  const target = withFormatExt(outputPath, format);
  const out = await COMPRESS_FORMATS[format].apply(sharp(raw)).toBuffer();
  await fs.writeFile(target, out);
  log(
    `✅ 图片已生成并压缩 [${COMPRESS_FORMATS[format].label}]: ${target} | ${fmtMB(raw.length)} → ${fmtMB(out.length)} (-${Math.max(0, Math.round((1 - out.length / raw.length) * 100))}%)`
  );
  return target;
}

/**
 * 兜底通路：后端能给出浏览器实例时（旧版 puppeteer 后端）
 * 保留原来的视窗/像素比控制，并显式等待图片与字体就绪
 */
async function screenshotWithBrowser(browser, html, outputPath, compress) {
  await fs.mkdir(TEMPLATES_DIR, { recursive: true });
  await fs.writeFile(TEMP_HTML_PATH, html, 'utf-8');
  log(`📄 HTML 已生成: ${TEMP_HTML_PATH}`);

  let page;
  try {
    page = await browser.newPage();

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('字体') || text.includes('✅') || text.includes('❌')) {
        log(`[浏览器 ${msg.type()}] ${text}`);
      }
    });

    page.on('requestfailed', request => {
      logError(`[浏览器 请求失败] ${request.url()} - ${request.failure().errorText}`);
    });

    await page.setViewport({ width: 1440, height: 1080, deviceScaleFactor: 2 });

    const fileUrl = 'file:///' + TEMP_HTML_PATH.replace(/\\/g, '/');
    log(`🌐 加载本地文件: ${fileUrl}`);
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    await page.evaluate(async () => {
      const images = Array.from(document.querySelectorAll('img'));
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.addEventListener('load', resolve);
          img.addEventListener('error', resolve);
        });
      }));
    });

    await page.evaluateHandle('document.fonts.ready');
    await page.waitForFunction(() => document.fonts.status === 'loaded', { timeout: 5000 })
      .catch(() => logWarn('⚠️ 字体加载状态未变为 loaded，继续截图'));

    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewport({ width: 1440, height: bodyHeight + 100, deviceScaleFactor: 2 });

    const screenshotBuffer = await page.screenshot({ type: 'png', fullPage: true });
    return await saveImage(screenshotBuffer, outputPath, compress);
  } finally {
    if (page) await page.close().catch(() => {});
    await fs.unlink(TEMP_HTML_PATH).catch(err => logWarn('⚠️ 清理临时文件失败:', err.message));
  }
}

/**
 * 默认通路：走后端自身的模板渲染接口（shotium / puppeteer 等统一入口）
 * 后端的截图对象是选中的容器元素，且不再由调用方控制视窗，
 * 因此需要：用 <base> 钉住资源根路径 + 固定 body 宽度 + zoom 保证排版与清晰度一致
 */
async function screenshotWithRendererApi(rendererObj, html, outputPath, scale = 2, width = LAYOUT_WIDTH, compress) {
  const baseUrl = pathToFileURL(TEMPLATES_DIR + path.sep).href;
  const style = `<style>html{${scale > 1 ? `zoom:${scale};` : ''}}body{width:${width}px!important;min-width:${width}px!important;}</style>`;
  // dealTpl 会把 html 另存到 temp/html/ 下，相对路径会失效 → 用 <base> 钉住资源目录
  const finalHtml = html
    .replace(/<head([^>]*)>/i, `<head$1><base href="${baseUrl}">`)
    .replace(/<\/head>/i, `${style}</head>`);
  if (!/<head[^>]*>/i.test(html)) logWarn('⚠️ 模板缺少 <head>，资源路径修正未生效');
  if (!/<\/head>/i.test(html)) logWarn('⚠️ 模板缺少 </head>，宽高修正未生效');

  const stamp = `daily-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tplFile = path.join(process.cwd(), 'temp', 'html', RENDER_NAME, `${stamp}.html`).replace(/\\/g, '/');
  // 后端 dealTpl 会另存一份到 temp/html/<name>/<saveId>.html，和源文件区分开，避免同名互相覆盖
  const saveId = `${stamp}-out`;

  await fs.mkdir(path.dirname(tplFile), { recursive: true });
  await fs.writeFile(tplFile, finalHtml, 'utf-8');

  let buffer;
  try {
    buffer = await rendererObj.render(RENDER_NAME, {
      tplFile,
      saveId,
      imgType: 'png',
      pageGotoParams: { waitUntil: 'networkidle0', timeout: 30000 }
    });
  } finally {
    // 源模板与后端另存的副本都是本次专用的一次性文件，用完即删
    await fs.unlink(tplFile).catch(() => {});
    await fs.unlink(path.join(process.cwd(), 'temp', 'html', RENDER_NAME, `${saveId}.html`)).catch(() => {});
    clearTplCache(tplFile);
  }

  if (!buffer) throw new Error(`${rendererObj.id} 未返回图片内容`);
  log(`🖼️ 使用 ${rendererObj.id} 渲染后端出图 (${scale}x)`);
  return await saveImage(buffer, outputPath, compress);
}

/**
 * 把已渲染好的 HTML 交给框架渲染成图片
 * 依次尝试各后端：先走后端自身的模板接口（默认通路，尊重 renderer.yaml 的配置），失败再退回浏览器直连
 * @param html 已填好数据的完整 HTML
 * @param outputPath 图片输出路径（实际扩展名会按压缩格式修正）
 * @param opts.scale 像素倍率（模板接口下用 CSS zoom 实现），默认 2
 * @param opts.width 固定布局宽度（css px），默认日报的 1408
 * @param opts.compress { enabled, format, quality } 压缩配置
 * @returns {Promise<string>} 实际写入的图片路径
 */
export async function renderHtmlToImage(html, outputPath, opts = {}) {
  const scale = Number(opts.scale) > 0 ? Number(opts.scale) : 2;
  const width = Number(opts.width) > 0 ? Number(opts.width) : LAYOUT_WIDTH;
  await getRenderRoot();

  const list = candidateRenderers(html);
  if (!list.length) throw new Error('没有可用的渲染后端');

  const errors = [];
  for (const rendererObj of list) {
    const id = rendererObj.id || rendererObj.constructor?.name || 'renderer';

    try {
      return await screenshotWithRendererApi(rendererObj, html, outputPath, scale, width, opts.compress);
    } catch (err) {
      errors.push(`${id}(模板接口): ${err.message}`);
      logWarn(`⚠️ ${id} 模板接口渲染失败: ${err.message}`);
    }

    const browser = await getBrowser(rendererObj);
    if (browser) {
      try {
        return await screenshotWithBrowser(browser, html, outputPath, opts.compress);
      } catch (err) {
        errors.push(`${id}(浏览器): ${err.message}`);
        logWarn(`⚠️ ${id} 浏览器截图失败: ${err.message}`);
      }
    }
  }

  throw new Error(`渲染失败 [${list.map(i => i.id).join(', ')}]：${errors.join(' | ')}`);
}

/**
 * 渲染日报模板到图片
 */
async function screenshotWithRenderer(templateFile, templateData, outputPath, opts = {}) {
  const html = nunjucks.render(templateFile, templateData);
  return await renderHtmlToImage(html, outputPath, opts);
}

/** 由配置解析出压缩参数 */
export function resolveCompress(config = {}, override = {}) {
  const enabled = override.enabled ?? (config.compressImage !== false && config.compressImage !== 'false');
  return {
    enabled,
    format: normalizeFormat(override.format || config.compressFormat)
  };
}

/**
 * 生成日报
 * @param {object} config 插件配置
 * @param {object} options { useMock:boolean 使用模拟数据, compress:{enabled,format,quality} }
 */
export async function generateDaily(config = {}, options = {}) {
  const outputDir = path.join(__dirname, '../../../temp/daily');
  await fs.mkdir(outputDir, { recursive: true });

  // Logo 加载
  const logoFileName = config.logoImage || 'logo.png';
  const logoPath = path.join(RESOURCES_DIR, 'images', logoFileName);
  let logoBase64 = '';
  try {
    const logoBuffer = await fs.readFile(logoPath);
    logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    log('✅ Logo 加载成功');
  } catch {
    logWarn('⚠️ Logo 文件未找到: ' + logoFileName);
    try {
      const defaultBuffer = await fs.readFile(path.join(RESOURCES_DIR, 'images', 'logo.png'));
      logoBase64 = `data:image/png;base64,${defaultBuffer.toString('base64')}`;
    } catch { logoBase64 = ''; }
  }

  // 获取固定模块数据（新闻、摸鱼、侧栏、IT）
  const baseData = options.useMock
    ? await fetchAllMockData(config)
    : await fetchAllData(config);

  // 热搜板块选择（三选一）
  const hotModule = config.hotModule || 'douyin';
  let hotData = null;
  let isBangumi = false;
  let isToutiao = false;

  if (hotModule === 'bangumi') {
    const mockBangumi = options.useMock ? baseData.bangumiData : null;
    if (mockBangumi) {
      hotData = { ...mockBangumi, items: (mockBangumi.items || []).slice(0, 10) };
      isBangumi = true;
      log(`📺 今日新番（本地示例数据）: ${hotData.items.length} 部`);
    } else {
      try {
        const { getTodayBangumi } = await import('./fetchers/bangumi.js');
        hotData = await getTodayBangumi(config);
        hotData.items = hotData.items.slice(0, 10);
        isBangumi = true;
        log(`📺 今日新番获取成功: ${hotData.items.length} 部`);
      } catch (err) {
        logError('今日新番获取失败，回退到抖音热搜:', err.message);
        hotData = await fetchDouyinHot(config);
        isBangumi = false;
      }
    }
  } else if (hotModule === 'toutiao') {
    hotData = (options.useMock && baseData.toutiaoHot?.length) ? baseData.toutiaoHot : await fetchToutiao(config);
    isToutiao = true;
    log(`📰 头条热搜获取成功: ${hotData.length} 条`);
  } else {
    hotData = (options.useMock && baseData.douyinHot?.length) ? baseData.douyinHot : await fetchDouyinHot(config);
  }

  const templateData = {
    // 固定模块数据
    date: baseData.date,
    moyuData: baseData.moyuData,
    zhihuHot: baseData.zhihuHot,
    bilibiliHot: baseData.bilibiliHot || [],
    sideModule: baseData.sideModule || resolveSideModule(config),
    worldNews: baseData.worldNews,
    itNews: baseData.itNews,
    generatedAt: baseData.generatedAt,
    // 配置项
    logoBase64,
    customTitle: config.customTitle || '芙芙心日报',
    logoSize: config.logoSize || '',
    titleFont: config.titleFont || 'Title.ttf',
    titleFontSize: config.titleFontSize || '',
    secondaryTitleFont: config.secondaryTitleFont || 'Secondary_Title.ttf',
    secondaryTitleFontSize: config.secondaryTitleFontSize || '35',
    contentFont: config.contentFont || 'Content.ttf',
    contentFontSize: config.contentFontSize || '',
    // 正文缩放系数：contentFontSize 视为基准正文字号（19px）的目标值，换算为 CSS 变量 --fscale
    // 例：contentFontSize 50 → --fscale 2.63 → 所有 calc(Npx * var(--fscale)) 的正文等比放大
    // 留空时按默认基准 25 换算（约 1.32 倍）
    contentFontScale: (Number(config.contentFontSize) > 0 ? Number(config.contentFontSize) : 25) / 19,
    // @font-face 的 format 提示按扩展名生成（.otf 是 CFF 轮廓 → opentype，其余按 truetype）
    titleFontFormat: fontFormat(config.titleFont || 'Title.ttf'),
    secondaryTitleFontFormat: fontFormat(config.secondaryTitleFont || 'Secondary_Title.ttf'),
    contentFontFormat: fontFormat(config.contentFont || 'Content.ttf'),
    // 热点数据（三选一）
    isBangumi,
    isToutiao,
    douyinHotList: hotModule === 'douyin' ? hotData : [],
    bangumiData: hotModule === 'bangumi' ? hotData : null,
    toutiaoHot: hotModule === 'toutiao' ? hotData : []
  };

  // theme → 模板映射；未知主题回退默认蓝色模板
  const THEME_TEMPLATES = {
    blue: 'base.html',
    pink: 'base_pink.html',
    lu: 'base_lu.html',       // 霜笺白鹭
    green: 'base_green.html', // 绿野青穗
    plain: 'base_plain.html'  // 素白简讯
  };
  const templateFile = THEME_TEMPLATES[config.theme] || 'base.html';
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  // 模拟预览的文件名带上主题，便于多主题连发时区分、也避免秒级时间戳重名
  const nameTag = options.useMock ? `mock-${config.theme}-` : '';
  const outputPath = path.join(outputDir, `fufu-${nameTag}${timestamp}.png`);

  log(`🎨 使用模板: ${templateFile}, 输出: ${outputPath}`);
  return await screenshotWithRenderer(templateFile, templateData, outputPath, {
    scale: Number(config.renderScale) > 0 ? Number(config.renderScale) : 1,
    compress: options.compress || resolveCompress(config)
  });
}
