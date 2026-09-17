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
 * 压缩格式表：值是 sharp 的处理方式
 *  - png-none：PNG 无压缩（zlib 仅存储，编码最快、体积最大，方便快速预览出图）
 *  - png     ：PNG 无损（最大 deflate 压缩，画质与渲染结果完全一致）
 *  - jpeg    ：JPEG 有损，体积最小
 *  - webp    ：WebP 有损，体积与画质兼顾
 */
const COMPRESS_FORMATS = {
  'png-none': { ext: '.png', label: 'PNG（无压缩）', apply: p => p.png({ compressionLevel: 0 }) },
  png: { ext: '.png', label: 'PNG（无损）', apply: p => p.png({ compressionLevel: 9, adaptiveFiltering: true }) },
  jpeg: { ext: '.jpg', label: 'JPEG（体积最小）', apply: (p, q) => p.flatten({ background: '#ffffff' }).jpeg({ quality: q, mozjpeg: true }) },
  webp: { ext: '.webp', label: 'WebP（兼顾体积与画质）', apply: (p, q) => p.webp({ quality: q }) }
};

/** jpg 是 jpeg 的别名，统一归一化，避免配置里写 jpg 时匹配不到 */
function normalizeFormat(format) {
  const f = String(format || 'png').toLowerCase();
  const alias = f === 'jpg' ? 'jpeg' : f;
  return COMPRESS_FORMATS[alias] ? alias : 'png';
}

/** 取压缩格式的中文名，用于日志与指令回显 */
export function compressFormatLabel(format) {
  return COMPRESS_FORMATS[normalizeFormat(format)].label;
}

nunjucks.configure(TEMPLATES_DIR, { autoescape: true });

export async function closeBrowser() {
  console.log('🔒 [furina-daily] 浏览器/渲染引擎由框架统一管理，无需关闭');
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
    console.warn(`⏳ [furina-daily] 获取 ${rendererObj.id} 浏览器实例失败: ${err.message}`);
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
async function saveImage(buffer, outputPath, compress = {}) {
  const raw = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const format = normalizeFormat(compress.format);
  const quality = Math.min(100, Math.max(1, Number(compress.quality) || 80));
  const target = withFormatExt(outputPath, format);

  await fs.mkdir(path.dirname(target), { recursive: true });

  if (compress.enabled === false) {
    await fs.writeFile(target, raw);
    console.log(`✅ 图片已生成（未压缩）: ${target} | ${(raw.length / 1024).toFixed(2)}KB`);
    return target;
  }

  const out = await COMPRESS_FORMATS[format].apply(sharp(raw), quality).toBuffer();
  await fs.writeFile(target, out);
  console.log(
    `✅ 图片已生成并压缩 [${COMPRESS_FORMATS[format].label}]: ${target} | ${(raw.length / 1024).toFixed(2)}KB → ${(out.length / 1024).toFixed(2)}KB (-${Math.max(0, Math.round((1 - out.length / raw.length) * 100))}%)`
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
  console.log(`📄 HTML 已生成: ${TEMP_HTML_PATH}`);

  let page;
  try {
    page = await browser.newPage();

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('字体') || text.includes('✅') || text.includes('❌')) {
        console.log(`[浏览器 ${msg.type()}] ${text}`);
      }
    });

    page.on('requestfailed', request => {
      console.error(`[浏览器 请求失败] ${request.url()} - ${request.failure().errorText}`);
    });

    await page.setViewport({ width: 1440, height: 1080, deviceScaleFactor: 2 });

    const fileUrl = 'file:///' + TEMP_HTML_PATH.replace(/\\/g, '/');
    console.log(`🌐 加载本地文件: ${fileUrl}`);
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
      .catch(() => console.warn('⚠️ 字体加载状态未变为 loaded，继续截图'));

    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewport({ width: 1440, height: bodyHeight + 100, deviceScaleFactor: 2 });

    const screenshotBuffer = await page.screenshot({ type: 'png', fullPage: true });
    return await saveImage(screenshotBuffer, outputPath, compress);
  } finally {
    if (page) await page.close().catch(() => {});
    await fs.unlink(TEMP_HTML_PATH).catch(err => console.warn('⚠️ 清理临时文件失败:', err.message));
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
  if (!/<head[^>]*>/i.test(html)) console.warn('⚠️ [furina-daily] 模板缺少 <head>，资源路径修正未生效');
  if (!/<\/head>/i.test(html)) console.warn('⚠️ [furina-daily] 模板缺少 </head>，宽高修正未生效');

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
  console.log(`🖼️ 使用 ${rendererObj.id} 渲染后端出图 (${scale}x)`);
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
      console.warn(`⚠️ [furina-daily] ${id} 模板接口渲染失败: ${err.message}`);
    }

    const browser = await getBrowser(rendererObj);
    if (browser) {
      try {
        return await screenshotWithBrowser(browser, html, outputPath, opts.compress);
      } catch (err) {
        errors.push(`${id}(浏览器): ${err.message}`);
        console.warn(`⚠️ [furina-daily] ${id} 浏览器截图失败: ${err.message}`);
      }
    }
  }

  throw new Error(`渲染失败 [${list.map(i => i.id).join(', ')}]：${errors.join(' | ')}`);
}

/**
 * 渲染日报模板到图片
 */
async function screenshotWithRenderer(templateFile, templateData, outputPath, opts = {}) {
  console.log(`🎨 渲染模板: ${templateFile}`);
  const html = nunjucks.render(templateFile, templateData);
  return await renderHtmlToImage(html, outputPath, opts);
}

/** 由配置解析出压缩参数 */
export function resolveCompress(config = {}, override = {}) {
  const enabled = override.enabled ?? (config.compressImage !== false && config.compressImage !== 'false');
  return {
    enabled,
    format: normalizeFormat(override.format || config.compressFormat),
    quality: Number(override.quality || config.compressQuality || 80)
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
    console.log('✅ Logo 加载成功');
  } catch {
    console.warn('⚠️ Logo 文件未找到: ' + logoFileName);
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
      console.log(`📺 今日新番（本地示例数据）: ${hotData.items.length} 部`);
    } else {
      try {
        const { getTodayBangumi } = await import('./fetchers/bangumi.js');
        hotData = await getTodayBangumi(config);
        hotData.items = hotData.items.slice(0, 10);
        isBangumi = true;
        console.log(`📺 今日新番获取成功: ${hotData.items.length} 部`);
      } catch (err) {
        console.error('今日新番获取失败，回退到抖音热搜:', err.message);
        hotData = await fetchDouyinHot(config);
        isBangumi = false;
      }
    }
  } else if (hotModule === 'toutiao') {
    hotData = (options.useMock && baseData.toutiaoHot?.length) ? baseData.toutiaoHot : await fetchToutiao(config);
    isToutiao = true;
    console.log(`📰 头条热搜获取成功: ${hotData.length} 条`);
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
    secondaryTitleFontSize: config.secondaryTitleFontSize || '',
    contentFont: config.contentFont || 'Content.ttf',
    contentFontSize: config.contentFontSize || '',
    // 热点数据（三选一）
    isBangumi,
    isToutiao,
    douyinHotList: hotModule === 'douyin' ? hotData : [],
    bangumiData: hotModule === 'bangumi' ? hotData : null,
    toutiaoHot: hotModule === 'toutiao' ? hotData : []
  };

  const templateFile = config.theme === 'pink' ? 'base_pink.html' : 'base.html';
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const ext = options.useMock ? 'mock-' : '';
  const outputPath = path.join(outputDir, `fufu-${ext}${timestamp}.png`);

  console.log(`🎨 使用模板: ${templateFile}, 输出: ${outputPath}`);
  return await screenshotWithRenderer(templateFile, templateData, outputPath, {
    scale: Number(config.renderScale) > 0 ? Number(config.renderScale) : 1,
    compress: options.compress || resolveCompress(config)
  });
}
