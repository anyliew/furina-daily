// src/index.js
import puppeteer from 'puppeteer';
import nunjucks from 'nunjucks';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import sharp from 'sharp';
import { fetchAllData } from './dataFetcher.js';
import { fetchDouyinHot } from './fetchers/douyin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESOURCES_DIR = path.join(__dirname, '../resources');
const TEMPLATES_DIR = path.join(RESOURCES_DIR, 'html');
const TEMP_HTML_PATH = path.join(TEMPLATES_DIR, 'daily.html');

nunjucks.configure(TEMPLATES_DIR, { autoescape: true });

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    console.log('🚀 启动新浏览器实例...');
    browserInstance = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--allow-file-access-from-files',
        '--disable-dev-shm-usage'
      ]
    });
  }
  return browserInstance;
}

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    console.log('🔒 浏览器实例已关闭');
  }
}

async function generateHTML(data) {
  return nunjucks.render('base.html', data);
}

async function generateImage(html, outputPath) {
  const browser = await getBrowser();
  let page = null;

  try {
    await fs.mkdir(TEMPLATES_DIR, { recursive: true });
    await fs.writeFile(TEMP_HTML_PATH, html, 'utf-8');
    console.log(`📄 临时 HTML 已写入: ${TEMP_HTML_PATH}`);

    page = await browser.newPage();

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('字体') || text.includes('✅') || text.includes('❌') || text.includes('🔍') || text.includes('📐') || text.includes('📝')) {
        console.log(`[浏览器 ${msg.type()}] ${text}`);
      }
    });

    page.on('requestfailed', request => {
      console.error(`[浏览器 请求失败] ${request.url()} - 错误: ${request.failure().errorText}`);
    });

    await page.setViewport({ width: 1440, height: 1080, deviceScaleFactor: 2 });

    const fileUrl = `file://${TEMP_HTML_PATH.replace(/\\/g, '/')}`;
    console.log(`🌐 加载 URL: ${fileUrl}`);
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });

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
      .png({ quality: 80, compressionLevel: 9, adaptiveFiltering: true, palette: true })
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

  // Logo 处理
  const logoFileName = config.logoImage || 'logo.png';
  const logoPath = path.join(RESOURCES_DIR, 'images', logoFileName);
  let logoBase64 = '';
  try {
    const logoBuffer = await fs.readFile(logoPath);
    logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    console.log('✅ Logo 加载成功');
  } catch (err) {
    console.warn('⚠️ Logo 文件未找到: ' + logoFileName + '，尝试回退默认');
    const defaultLogoPath = path.join(RESOURCES_DIR, 'images', 'logo.png');
    try {
      const defaultBuffer = await fs.readFile(defaultLogoPath);
      logoBase64 = `data:image/png;base64,${defaultBuffer.toString('base64')}`;
      console.log('ℹ️ 已回退到默认Logo');
    } catch {
      logoBase64 = '';
    }
  }

  const baseData = await fetchAllData();

  const hotModule = config.hotModule || 'douyin';
  let hotData = null;
  let isBangumi = false;

  if (hotModule === 'bangumi') {
    try {
      const { getTodayBangumi } = await import('./fetchers/bangumi.js');
      hotData = await getTodayBangumi();
      hotData.items = hotData.items.slice(0, 10);   // 最多显示 10 部
      isBangumi = true;
      console.log(`📺 今日新番获取成功: ${hotData.items.length} 部`);
    } catch (err) {
      console.error('今日新番获取失败，回退到抖音热搜:', err.message);
      hotData = await fetchDouyinHot();
      isBangumi = false;
    }
  } else {
    hotData = await fetchDouyinHot();
  }

  const data = {
    ...baseData,
    logoBase64,
    customTitle: config.customTitle || '芙芙心日报',
    logoSize: config.logoSize || '',
    titleFont: config.titleFont || 'Title.ttf',
    titleFontSize: config.titleFontSize || '',
    secondaryTitleFont: config.secondaryTitleFont || 'Secondary_Title.ttf',
    secondaryTitleFontSize: config.secondaryTitleFontSize || '',
    contentFont: config.contentFont || 'Content.ttf',
    contentFontSize: config.contentFontSize || '',
    isBangumi,
    douyinHotList: hotModule !== 'bangumi' ? hotData : [],
    bangumiData: hotModule === 'bangumi' ? hotData : null
  };

  const html = await generateHTML(data);

  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const outputPath = path.join(outputDir, `fufu-${timestamp}.png`);

  await generateImage(html, outputPath);
  return outputPath;
}