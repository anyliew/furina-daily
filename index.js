// index.js - furina-daily 插件入口
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateDaily, closeBrowser } from './src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appsDir = path.join(__dirname, 'apps');

// 动态加载 apps 目录下的所有插件（如 daily.js）
const appFiles = fs.readdirSync(appsDir).filter(file => file.endsWith('.js'));
const apps = {};

for (const file of appFiles) {
  const name = file.replace('.js', '');
  try {
    const module = await import(`./apps/${file}`);
    apps[name] = module.default;
    logger.mark(`[furina-daily] 载入插件成功：${name}`);
  } catch (err) {
    logger.error(`[furina-daily] 载入插件错误：${name}`);
    logger.error(err);
  }
}

logger.mark('[furina-daily] 插件入口加载完毕');

export { apps, generateDaily, closeBrowser };