// src/index.js - 使用 Yunzai 渲染器的浏览器实例生成日报
import fs from 'fs/promises';
import nunjucks from 'nunjucks';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import renderer from '../../../lib/puppeteer/puppeteer.js';
import { fetchAllData } from './dataFetcher.js';
import { fetchDouyinHot } from './fetchers/douyin.js';
import { fetchToutiao } from './fetchers/toutiao.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESOURCES_DIR = path.join(__dirname, '../resources');
const TEMPLATES_DIR = path.join(RESOURCES_DIR, 'html');
const TEMP_HTML_PATH = path.join(TEMPLATES_DIR, 'daily.html');

nunjucks.configure(TEMPLATES_DIR, { autoescape: true });

export async function closeBrowser() {
  console.log('🔒 [furina-daily] Yunzai 渲染器浏览器由框架管理');
}

/**
 * 确保 Yunzai 渲染器的浏览器实例已启动并可用
 */
async function ensureBrowser() {
  if (renderer.browser && renderer.browser.isConnected()) return;
  console.log('⏳ 初始化/重用浏览器...');
  const initTpl = path.join(__dirname, '../resources/html/test.html').replace(/\\/g, '/');
  try {
    await renderer.render('_furina_init', { tplFile: initTpl, saveId: 'init' });
  } catch (e) {
    console.warn('⏳ 浏览器初始化调用完成 (可能无图片输出):', e.message);
  }
  if (!renderer.browser || !renderer.browser.isConnected()) {
    throw new Error('无法获取 Yunzai 浏览器实例');
  }
  console.log('✅ 浏览器实例就绪');
}

/**
 * 通过 renderer.browser 创建页面，加载我们的 HTML 并截图
 */
async function screenshotWithRenderer(templateFile, templateData, outputPath) {
  await ensureBrowser();

  const html = nunjucks.render(templateFile, templateData);
  await fs.mkdir(TEMPLATES_DIR, { recursive: true });
  await fs.writeFile(TEMP_HTML_PATH, html, 'utf-8');
  console.log(`📄 HTML 已生成: ${TEMP_HTML_PATH}`);

  const browser = renderer.browser;
  let page;
  try {
    page = await browser.newPage();

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('字体') || text.includes('✅') || text.includes('❌') ||
          text.includes('🔍') || text.includes('📐') || text.includes('📝')) {
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

    const compressedBuffer = await sharp(screenshotBuffer)
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true })
      .toBuffer();

    await fs.writeFile(outputPath, compressedBuffer);

    const originalSize = (screenshotBuffer.length / 1024).toFixed(2);
    const compressedSize = (compressedBuffer.length / 1024).toFixed(2);
    console.log(`✅ 图片已生成并压缩: ${outputPath}`);
    console.log(`📊 原始大小: ${originalSize} KB | 压缩后: ${compressedSize} KB (减少 ${((1 - compressedBuffer.length / screenshotBuffer.length) * 100).toFixed(1)}%)`);

    return outputPath;
  } finally {
    if (page) await page.close().catch(() => {});
    await fs.unlink(TEMP_HTML_PATH).catch(err => console.warn('⚠️ 清理临时文件失败:', err.message));
  }
}

export async function generateDaily(config = {}) {
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

  // 获取固定模块数据（新闻、摸鱼、知乎、IT）
  const baseData = await fetchAllData(config);

  // 热搜板块选择（三选一）
  const hotModule = config.hotModule || 'douyin';
  let hotData = null;
  let isBangumi = false;
  let isToutiao = false;

  if (hotModule === 'bangumi') {
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
  } else if (hotModule === 'toutiao') {
    hotData = await fetchToutiao(config);
    isToutiao = true;
    console.log(`📰 头条热搜获取成功: ${hotData.length} 条`);
  } else {
    hotData = await fetchDouyinHot(config);
  }

  const templateData = {
    // 固定模块数据
    date: baseData.date,
    moyuData: baseData.moyuData,
    zhihuHot: baseData.zhihuHot,
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
  const outputPath = path.join(outputDir, `fufu-${timestamp}.png`);

  console.log(`🎨 使用模板: ${templateFile}, 输出: ${outputPath}`);
  await screenshotWithRenderer(templateFile, templateData, outputPath);

  return outputPath;
}