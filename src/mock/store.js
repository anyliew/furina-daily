// src/mock/store.js
// 模拟数据仓库：resources/mock/<模块>.json + resources/mock/images/
// 由「日报模拟数据生成」写入，API 全部失败时作为兜底数据使用
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MOCK_DIR = path.join(__dirname, '../../resources/mock');
export const MOCK_IMAGE_DIR = path.join(MOCK_DIR, 'images');
const META_FILE = path.join(MOCK_DIR, 'meta.json');

/** 支持写入模拟数据的模块 */
export const MOCK_KEYS = ['news60s', 'moyu', 'zhihu', 'bilibili', 'itNews', 'douyin', 'toutiao', 'bangumi'];

/** 需要解析成本地图片路径的字段名 */
const IMAGE_FIELDS = new Set(['cover', 'image', 'bgImage', 'icon', 'pic']);

export async function ensureMockDir() {
  await fs.mkdir(MOCK_IMAGE_DIR, { recursive: true });
}

/**
 * 读取某模块的模拟数据
 * @returns {Promise<any|null>} 不存在或损坏时返回 null
 */
export async function readMock(key) {
  try {
    const raw = await fs.readFile(path.join(MOCK_DIR, `${key}.json`), 'utf-8');
    const data = JSON.parse(raw);
    return hydrateImages(data);
  } catch {
    return null;
  }
}

/** 写入某模块的模拟数据（自动补全目录并刷新 meta） */
export async function writeMock(key, data) {
  await ensureMockDir();
  await fs.writeFile(path.join(MOCK_DIR, `${key}.json`), JSON.stringify(data, null, 2), 'utf-8');
}

export async function readMeta() {
  try {
    return JSON.parse(await fs.readFile(META_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

export async function writeMeta(meta) {
  await ensureMockDir();
  await fs.writeFile(META_FILE, JSON.stringify(meta, null, 2), 'utf-8');
}

/** 各模块模拟数据的概况（是否有数据、条数、更新时间） */
export async function getMockStatus() {
  const meta = (await readMeta()) || {};
  const items = [];
  for (const key of MOCK_KEYS) {
    const data = await readMock(key);
    let count = 0;
    if (Array.isArray(data)) count = data.length;
    else if (data && Array.isArray(data.worldNews)) count = data.worldNews.length;
    else if (data && Array.isArray(data.items)) count = data.items.length;
    else if (data && Array.isArray(data.countdowns)) count = data.countdowns.length;
    items.push({ key, has: !!data, count, updatedAt: meta[key] || '' });
  }
  return { items, generatedAt: meta.generatedAt || '', imageCount: await countImages() };
}

export async function countImages() {
  try {
    const files = await fs.readdir(MOCK_IMAGE_DIR);
    return files.length;
  } catch {
    return 0;
  }
}

/** 清空模拟数据（含图片） */
export async function clearMock() {
  await fs.rm(MOCK_DIR, { recursive: true, force: true });
}

/**
 * 把模拟数据里的相对图片名解析成本地 file:// 绝对地址
 * 渲染后端加载的是 temp/html 下的临时文件，写相对路径会 404
 */
export function resolveAsset(value) {
  if (typeof value !== 'string' || !value) return value;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('file:')) return value;
  return pathToFileURL(path.join(MOCK_IMAGE_DIR, path.basename(value))).href;
}

function hydrateImages(node) {
  if (Array.isArray(node)) return node.map(hydrateImages);
  if (!node || typeof node !== 'object') return node;

  const out = { ...node };
  for (const key of Object.keys(out)) {
    const value = out[key];
    if (typeof value === 'string') {
      if (IMAGE_FIELDS.has(key)) out[key] = resolveAsset(value);
    } else if (value && typeof value === 'object') {
      out[key] = hydrateImages(value);
    }
  }
  return out;
}
