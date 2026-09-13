// src/mockGenerator.js
// 「日报模拟数据生成」：抓取今日真实数据写入 resources/mock/，并把封面等图片资源下载到 resources/mock/images/
import path from 'path';
import { pathToFileURL } from 'url';
import fs from 'fs/promises';
import axios from 'axios';
import sharp from 'sharp';
import { format } from 'date-fns';
import { MOCK_IMAGE_DIR, writeMock, writeMeta, ensureMockDir } from './mock/store.js';
import { fetchNews60s } from './fetchers/news60s.js';
import { fetchMoyuData } from './fetchers/moyu.js';
import { fetchZhihu } from './fetchers/zhihu.js';
import { fetchBilibiliHot } from './fetchers/bilibili.js';
import { fetchITNews } from './fetchers/itNews.js';
import { fetchDouyinHot } from './fetchers/douyin.js';
import { fetchToutiao } from './fetchers/toutiao.js';
import { getTodayBangumi } from './fetchers/bangumi.js';

/** 单个模块最多下载多少张图 */
const MAX_IMAGES_PER_MODULE = 10;
const IMAGE_TIMEOUT = 10000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

/** 模块抓取任务：名称 + 抓取函数（useMock:false 表示失败直接抛，不退回旧 mock） */
const JOBS = [
  { key: 'news60s', label: '60s 读世界', run: c => fetchNews60s(c, { useMock: false }) },
  { key: 'moyu', label: '摸鱼日历', run: c => fetchMoyuData(c, { useMock: false }) },
  { key: 'zhihu', label: '知乎话题榜', run: c => fetchZhihu(c, { useMock: false }) },
  { key: 'bilibili', label: '哔哩哔哩热搜', run: c => fetchBilibiliHot(c, { useMock: false }) },
  { key: 'itNews', label: 'IT 资讯', run: c => fetchITNews(c, { useMock: false }) },
  { key: 'douyin', label: '抖音热搜', run: c => fetchDouyinHot(c, { useMock: false }) },
  { key: 'toutiao', label: '头条热搜', run: c => fetchToutiao(c, { useMock: false }) },
  {
    key: 'bangumi',
    label: '今日新番',
    run: async (c) => {
      const data = await getTodayBangumi(c, { useMock: false });
      return { ...data, items: (data.items || []).slice(0, 10) };
    }
  }
];

/** 需要把网络图片另存为本地文件的字段 */
const IMAGE_FIELDS = new Set(['cover', 'image', 'bgImage', 'pic']);

/** 模拟图片统一转成 jpeg 存储，避免不同源的扩展名/格式混用 */
const IMG_EXT = '.jpg';
/** 封面在日报里只显示 250px 左右，存 2 倍宽足够，能省下大量体积 */
const IMG_WIDTH = 480;
const IMG_QUALITY = 82;

async function downloadImage(url, dest) {
  const res = await axios.get(url, {
    timeout: IMAGE_TIMEOUT,
    responseType: 'arraybuffer',
    maxContentLength: MAX_IMAGE_BYTES,
    headers: { 'User-Agent': UA, Referer: new URL(url).origin + '/' }
  });
  const buf = Buffer.from(res.data);
  if (!buf.length || buf.length > MAX_IMAGE_BYTES) throw new Error('图片过大或为空');

  try {
    const out = await sharp(buf)
      .rotate()
      .resize({ width: IMG_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: IMG_QUALITY, mozjpeg: true })
      .toBuffer();
    await fs.writeFile(dest, out);
    return out.length;
  } catch (e) {
    // sharp 处理不了（如特殊格式）就存原图，模板仍可显示
    globalThis.logger?.debug?.(`[furina-daily] 模拟数据图片压缩失败，存原图 ${url}: ${e.message}`);
    await fs.writeFile(dest, buf);
    return buf.length;
  }
}

/**
 * 遍历数据结构，把图片字段的网络地址下载到本地并改写为文件名
 * @returns {Promise<{data:any, downloaded:number, failed:number}>}
 */
async function localizeImages(key, data) {
  let downloaded = 0;
  let failed = 0;
  let seq = 0;

  const handle = async (node) => {
    if (Array.isArray(node)) {
      for (const item of node) await handle(item);
      return node;
    }
    if (!node || typeof node !== 'object') return node;

    for (const field of Object.keys(node)) {
      const value = node[field];
      if (typeof value === 'string' && IMAGE_FIELDS.has(field) && /^https?:\/\//i.test(value)) {
        if (seq >= MAX_IMAGES_PER_MODULE) break;
        const name = `${key}-${++seq}${IMG_EXT}`;
        try {
          await downloadImage(value, path.join(MOCK_IMAGE_DIR, name));
          node[field] = name;
          downloaded++;
        } catch (e) {
          // 下载失败就置空，模板会走占位图，避免出现一张永远加载不出来的图
          node[field] = '';
          failed++;
          globalThis.logger?.debug?.(`[furina-daily] 模拟数据图片下载失败 ${value}: ${e.message}`);
        }
      } else if (value && typeof value === 'object') {
        await handle(value);
      }
    }
    return node;
  };

  const result = await handle(data);
  return { data: result, downloaded, failed };
}

/**
 * 抓取今日真实数据，写入模拟数据仓库（含图片资源）
 * @param {object} config 插件配置
 * @param {(msg:string)=>void} onProgress 进度回调
 * @returns {Promise<{ok:string[], failed:{key:string,label:string,reason:string}[], images:number, dir:string}>}
 */
export async function generateMockData(config = {}, onProgress) {
  await ensureMockDir();
  // 旧图片先清掉，避免堆积一堆过期文件
  await fs.rm(MOCK_IMAGE_DIR, { recursive: true, force: true });
  await ensureMockDir();

  const ok = [];
  const failed = [];
  let images = 0;
  const meta = { generatedAt: format(new Date(), 'yyyy-MM-dd HH:mm:ss') };

  for (const job of JOBS) {
    onProgress?.(`正在抓取 ${job.label}...`);
    try {
      const data = await job.run(config);
      const localized = await localizeImages(job.key, data);
      await writeMock(job.key, localized.data);
      meta[job.key] = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
      images += localized.downloaded;
      ok.push(job.label);
    } catch (err) {
      failed.push({ key: job.key, label: job.label, reason: err.message });
      globalThis.logger?.warn?.(`[furina-daily] 模拟数据 ${job.label} 抓取失败: ${err.message}`);
    }
  }

  await writeMeta(meta);
  return { ok, failed, images, dir: MOCK_IMAGE_DIR, generatedAt: meta.generatedAt };
}

/** 模拟数据目录（供命令回显给用户） */
export function getMockDir() {
  return MOCK_IMAGE_DIR;
}

/** 供调试：某个模拟图片名的本地 file 地址 */
export function mockImageUrl(name) {
  return pathToFileURL(path.join(MOCK_IMAGE_DIR, name)).href;
}
