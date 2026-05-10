// apps/daily.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import schedule from 'node-schedule';
import yaml from 'js-yaml';
import { generateDaily, closeBrowser } from '../src/index.js';

const { default: Plugin } = await import('../../../lib/plugins/plugin.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginRoot = path.resolve(__dirname, '..');

const defaultConfigPath = path.join(pluginRoot, 'config', 'default_config', 'daily.yaml');
const userConfigPath = path.join(pluginRoot, 'config', 'config', 'daily.yaml');

function ensureUserConfig() {
  const userConfigDir = path.dirname(userConfigPath);
  if (!fs.existsSync(userConfigDir)) {
    fs.mkdirSync(userConfigDir, { recursive: true });
  }
  if (!fs.existsSync(userConfigPath)) {
    fs.copyFileSync(defaultConfigPath, userConfigPath);
    logger.mark('[furina-daily] 已生成用户配置文件 config/config/daily.yaml');
  }
}
ensureUserConfig();

export function loadFullConfig() {
  try {
    const data = fs.readFileSync(userConfigPath, 'utf8');
    const config = yaml.load(data) || {};
    return {
      reportGroup: Array.isArray(config.reportGroup) ? config.reportGroup : (config.reportGroup ? [config.reportGroup] : []),
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
      apiBase: {
        bangumi: config.apiBase?.bangumi || 'https://api.bgm.tv',
        viki: config.apiBase?.viki || 'https://60s.viki.moe'
      },
      theme: config.theme || 'blue'
    };
  } catch (err) {
    logger.error(`[furina-daily] 读取用户配置失败: ${err.message}`);
    return {
      reportGroup: [],
      morningTime: '0 10 * * *',
      eveningTime: '0 22 * * *',
      customTitle: '芙芙心日报',
      logoImage: 'logo.png',
      logoSize: '',
      titleFont: 'Title.ttf',
      titleFontSize: '',
      secondaryTitleFont: 'Secondary_Title.ttf',
      secondaryTitleFontSize: '',
      contentFont: 'Content.ttf',
      contentFontSize: '',
      hotModule: 'douyin',
      apiBase: {
        bangumi: 'https://api.bgm.tv',
        viki: 'https://60s.viki.moe'
      },
      theme: 'blue'
    };
  }
}

export function saveFullConfig(data) {
  try {
    const config = {
      reportGroup: data.reportGroup || [],
      morningTime: data.morningTime || '0 10 * * *',
      eveningTime: data.eveningTime || '0 22 * * *',
      customTitle: data.customTitle || '芙芙心日报',
      logoImage: data.logoImage || 'logo.png',
      logoSize: data.logoSize || '',
      titleFont: data.titleFont || 'Title.ttf',
      titleFontSize: data.titleFontSize || '',
      secondaryTitleFont: data.secondaryTitleFont || 'Secondary_Title.ttf',
      secondaryTitleFontSize: data.secondaryTitleFontSize || '',
      contentFont: data.contentFont || 'Content.ttf',
      contentFontSize: data.contentFontSize || '',
      hotModule: data.hotModule || 'douyin',
      apiBase: {
        bangumi: data.apiBase?.bangumi || 'https://api.bgm.tv',
        viki: data.apiBase?.viki || 'https://60s.viki.moe'
      },
      theme: data.theme || 'blue'
    };
    fs.writeFileSync(userConfigPath, yaml.dump(config), 'utf8');
  } catch (err) {
    logger.error(`[furina-daily] 保存配置失败: ${err.message}`);
  }
}

let config = loadFullConfig();
let morningJob = null;
let eveningJob = null;
let refreshJobs = [];
let isGenerating = false;

let cachedImagePath = null;
let cachedDate = '';

function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addReportGroup(groupId) {
  if (config.reportGroup.includes(groupId)) return false;
  config.reportGroup.push(groupId);
  saveFullConfig(config);
  return true;
}

function removeReportGroup(groupId) {
  const index = config.reportGroup.indexOf(groupId);
  if (index === -1) return false;
  config.reportGroup.splice(index, 1);
  saveFullConfig(config);
  return true;
}

async function generateAndGetImage(forceRefresh = false) {
  const today = getTodayStr();
  if (!forceRefresh && cachedImagePath && cachedDate === today && fs.existsSync(cachedImagePath)) {
    logger.debug(`[furina-daily] 使用今日缓存: ${cachedImagePath}`);
    return cachedImagePath;
  }

  if (isGenerating) {
    logger.warn('[furina-daily] 日报生成任务进行中，跳过');
    return null;
  }
  isGenerating = true;
  try {
    logger.mark('[furina-daily] 开始生成芙芙日报...');
    const imagePath = await generateDaily(config);
    logger.mark(`[furina-daily] 日报生成成功: ${imagePath}`);

    try {
      const dir = path.dirname(imagePath);
      const newFileName = path.basename(imagePath);
      const files = fs.readdirSync(dir);
      let deletedCount = 0;
      for (const file of files) {
        const filePath = path.join(dir, file);
        if (file !== newFileName && /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(file)) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
      if (deletedCount > 0) logger.debug(`[furina-daily] 已清理 ${deletedCount} 个旧图片`);
    } catch (err) {
      logger.warn(`[furina-daily] 清理旧图片错误: ${err.message}`);
    }

    cachedImagePath = imagePath;
    cachedDate = today;
    return imagePath;
  } catch (err) {
    logger.error(`[furina-daily] 生成失败: ${err.message}`);
    return null;
  } finally {
    isGenerating = false;
  }
}

async function sendImageToSession(session, imagePath) {
  if (!imagePath || !fs.existsSync(imagePath)) {
    await session.reply("❌ 日报文件丢失，生成失败。");
    return false;
  }
  try {
    await session.reply(segment.image(imagePath));
    return true;
  } catch (err) {
    logger.error(`[furina-daily] 发送失败: ${err.message}`);
    await session.reply("❌ 发送日报失败。");
    return false;
  }
}

async function sendDailyToAll() {
  const imagePath = await generateAndGetImage();
  if (!imagePath) return;
  const bot = Bot;
  for (const groupId of config.reportGroup) {
    try {
      const group = await bot.pickGroup(groupId);
      await group.sendMsg(segment.image(imagePath));
      logger.mark(`[furina-daily] 已发送至群 ${groupId}`);
      await sleep(1000);
    } catch (err) {
      logger.error(`[furina-daily] 发送失败群 ${groupId}: ${err.message}`);
    }
  }
}

export function scheduleTasks() {
  if (morningJob) morningJob.cancel();
  if (eveningJob) eveningJob.cancel();
  refreshJobs.forEach(job => job.cancel());
  refreshJobs = [];

  morningJob = schedule.scheduleJob(config.morningTime, async () => {
    logger.mark(`[furina-daily] 早间推送 (${config.morningTime})`);
    await sendDailyToAll();
  });
  eveningJob = schedule.scheduleJob(config.eveningTime, async () => {
    logger.mark(`[furina-daily] 晚间推送 (${config.eveningTime})`);
    await sendDailyToAll();
  });

  const refreshTimes = [
    { cron: '30 7 * * *', desc: '上午7:30' },
    { cron: '30 9 * * *', desc: '上午9:30' },
    { cron: '30 17 * * *', desc: '下午5:30' },
    { cron: '0 21 * * *', desc: '晚上9:00' }
  ];
  refreshTimes.forEach(({ cron, desc }) => {
    const job = schedule.scheduleJob(cron, async () => {
      logger.mark(`[furina-daily] ${desc} 刷新缓存`);
      await generateAndGetImage(true);
    });
    refreshJobs.push(job);
  });
  logger.mark(`[furina-daily] 定时任务已设置: 早 ${config.morningTime}, 晚 ${config.eveningTime}`);
}

scheduleTasks();

let configWatcher = null;
function watchConfig() {
  if (configWatcher) configWatcher.close();
  configWatcher = fs.watch(userConfigPath, (eventType) => {
    if (eventType === 'change') {
      logger.mark('[furina-daily] 检测到配置文件变更，重新加载');
      config = loadFullConfig();
    }
  });
}
watchConfig();

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export { config };

export default class furinaDaily extends Plugin {
  constructor() {
    super({
      name: "芙芙日报",
      dsc: "每日早晚定时推送，支持订阅、手动获取、刷新",
      event: "message",
      priority: 5000,
      rule: [
        { reg: "^开启日报推送$", fnc: "subscribeGroup" },
        { reg: "^关闭日报推送$", fnc: "unsubscribeGroup" },
        { reg: "^(芙芙日报|日报)$", fnc: "manualDaily" },
        { reg: "^刷新日报$", fnc: "refreshDaily" },
        { reg: "^日报清空配置$", fnc: "clearConfig" },
        { reg: "^日报切换抖音热搜$", fnc: "switchDouyin" },
        { reg: "^日报切换今日新番$", fnc: "switchBangumi" },
        { reg: /^日报主题切换\s*(.*)$/, fnc: "switchTheme" }
      ]
    });
  }

  async subscribeGroup(e) {
    if (!e.isGroup) return e.reply("❌ 仅群聊可用");
    const groupId = e.group_id;
    if (addReportGroup(groupId)) {
      e.reply(`✅ 已开启日报推送！本群将在每日${config.morningTime}和${config.eveningTime}自动发送日报。`);
    } else {
      e.reply(`🌸 本群已开启日报推送，无需重复操作。`);
    }
  }

  async unsubscribeGroup(e) {
    if (!e.isGroup) return e.reply("❌ 仅群聊可用");
    const groupId = e.group_id;
    if (removeReportGroup(groupId)) {
      e.reply(`❎ 已关闭日报推送。`);
    } else {
      e.reply(`🍃 本群未开启日报推送。`);
    }
  }

  async manualDaily(e) {
    logger.debug(`[furina-daily] 手动获取日报 by ${e.user_id}`);
    const imagePath = await generateAndGetImage();
    if (imagePath) {
      await sendImageToSession(e, imagePath);
    } else {
      await e.reply("❌ 日报生成失败。");
    }
  }

  async refreshDaily(e) {
    logger.debug(`[furina-daily] 刷新日报 by ${e.user_id}`);
    await e.reply("🔄 正在刷新日报...");
    const imagePath = await generateAndGetImage(true);
    if (imagePath) {
      await e.reply(segment.image(imagePath));
    } else {
      await e.reply("❌ 日报刷新失败。");
    }
  }

  // 主人指令：清空配置
  async clearConfig(e) {
    if (!e.isMaster) {
      await e.reply('❌ 仅BOT主人可使用此命令');
      return false;
    }
    try {
      const backupDir = path.dirname(userConfigPath);
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
      const randomStr = Math.random().toString(36).slice(2, 8);
      const backupName = `daily_${dateStr}_${timeStr}_${randomStr}.yaml`;
      const backupPath = path.join(backupDir, backupName);

      if (fs.existsSync(userConfigPath)) {
        fs.copyFileSync(userConfigPath, backupPath);
        logger.mark(`[furina-daily] 配置已备份至 ${backupName}`);
      }

      fs.copyFileSync(defaultConfigPath, userConfigPath);
      logger.mark('[furina-daily] 配置已重置为默认');

      config = loadFullConfig();
      scheduleTasks();

      await e.reply(`✅ 日报配置已重置为默认，原配置备份为 ${backupName}`);
    } catch (err) {
      logger.error('[furina-daily] 清空配置失败:', err);
      await e.reply(`❌ 清空配置失败：${err.message}`);
    }
    return true;
  }

  // 主人指令：切换至抖音热搜
  async switchDouyin(e) {
    if (!e.isMaster) {
      await e.reply('❌ 仅BOT主人可使用此命令');
      return false;
    }
    if (config.hotModule === 'douyin') {
      await e.reply('当前热搜板块已是抖音热搜，无需切换');
      return true;
    }
    config.hotModule = 'douyin';
    saveFullConfig(config);
    logger.mark('[furina-daily] 已切换至抖音热搜');
    await e.reply('✅ 已切换为抖音热搜，下次生成日报时生效');
    return true;
  }

  // 主人指令：切换至今日新番
  async switchBangumi(e) {
    if (!e.isMaster) {
      await e.reply('❌ 仅BOT主人可使用此命令');
      return false;
    }
    if (config.hotModule === 'bangumi') {
      await e.reply('当前热搜板块已是今日新番，无需切换');
      return true;
    }
    config.hotModule = 'bangumi';
    saveFullConfig(config);
    logger.mark('[furina-daily] 已切换至今日新番');
    await e.reply('✅ 已切换为今日新番，下次生成日报时生效');
    return true;
  }

  // 主人指令：主题切换
  async switchTheme(e) {
    if (!e.isMaster) {
      await e.reply('❌ 仅BOT主人可使用此命令');
      return false;
    }
    const msg = e.msg || e.message || '';
    if (/芙芙蓝色/.test(msg)) {
      config.theme = 'blue';
      saveFullConfig(config);
      await e.reply('✅ 已切换至主题【芙芙蓝色】，下次生成日报时生效');
      return true;
    }
    if (/真寻粉色/.test(msg)) {
      config.theme = 'pink';
      saveFullConfig(config);
      await e.reply('✅ 已切换至主题【真寻粉色】，下次生成日报时生效');
      return true;
    }
    await e.reply('❌ 主题名称错误，可用主题：芙芙蓝色、真寻粉色。示例：日报主题切换 芙芙蓝色');
    return false;
  }
}