![furina-daily](https://socialify.git.ci/anyliew/furina-daily/image?custom_description=%E4%B8%80%E6%AC%BE%E4%B8%BAYunzai-Bot%E5%AE%9A%E5%88%B6%E7%9A%84%E4%BA%8C%E6%AC%A1%E5%85%83%E6%9E%AB%E4%B8%B9%E6%B0%B4%E7%A5%9E%E8%8A%99%E5%AE%81%E5%A8%9C%E9%A3%8E%E6%A0%BC%E6%97%A5%E6%8A%A5%E6%8F%92%E4%BB%B6&description=1&forks=1&issues=1&language=1&logo=https%3A%2F%2Fupload-bbs.miyoushe.com%2Fupload%2F2026%2F05%2F10%2F365152535%2F9e5518d5af0730d5a130dc1497425383_1984973882035861799.png&name=1&owner=1&pulls=1&stargazers=1&theme=Light)

![芙芙日报](https://upload-bbs.miyoushe.com/upload/2026/05/03/365152535/a65f9320ab2d369b16745c20633b5600_3131922939226961435.jpg)

# 芙芙日报 · Furina Daily

每日自动生成精美日报图片，支持多群推送、锅巴可视化配置、一键更新、主题切换与热搜板块选择。

## 🖼 作品展示

### 芙芙日报 效果图
<details><summary>🖼日报　芙芙蓝色主题</summary><p>
<a><img src="./docs/images/Blue.png"></a>
</details>

<details><summary>🖼日报　真寻粉色主题</summary><p>
<a><img src="./docs/images/Pink.png"></a>
</details>

### 日报帮助 效果图
<details><summary>🖼帮助</summary><p>
<a><img src="./docs/images/help.png"></a>
</details>

### 锅巴配置 效果图
<details><summary>🖼锅巴</summary><p>
<a><img src="./docs/images/guoba.png"></a>
</details>

## ✨ 主要功能

- **定时推送**：可自定义早晚推送时间（默认 10:00 / 22:00），自动生成并发送至订阅群
- **手动获取**：随时获取最新日报，基于日期智能缓存，不重复生成
- **热搜板块**：可切换「抖音热搜」或「今日新番」（Bangumi），在锅巴面板或使用指令随时更换
- **主题切换**：内置「芙芙蓝色」「真寻粉色」双主题，锅巴或指令一键切换
- **自定义 API**：可单独设置 Bangumi API 基址及 60s API 基址，适配私有镜像或代理
- **锅巴适配**：支持在 Guoba-Plugin 管理面板中可视化配置推送群、时间、热搜、主题、API 地址等
- **帮助菜单**：生成精美的插件功能说明图片，每日缓存，内容随新功能同步更新
- **一键更新**：仅需发送指令即可 `git pull` 更新插件（仅 Bot 主人可用）
- **一键清空配置**：备份当前配置并恢复为默认设置（仅 Bot 主人可用）
- **自动清理**：每次生成后自动删除旧的日报图片，保持目录整洁

## 📦 安装方法

在 Yunzai-Bot 根目录下执行：

```bash
git clone --depth=1 https://github.com/anyliew/furina-daily.git ./plugins/furina-daily
cd ./plugins/furina-daily
pnpm i
```
⚙️ 配置说明
首次运行时插件会自动生成配置文件 config/config/daily.yaml。
推荐使用锅巴面板进行可视化配置（无需手动编辑 YAML）。

配置文件示例
```yaml
reportGroup:
  - 123456789       # 推送群号
morningTime: '0 10 * * *'   # 早间推送 Cron 表达式
eveningTime: '0 22 * * *'   # 晚间推送 Cron 表达式
customTitle: '芙芙心日报'     # 自定义标题
logoImage: 'logo.png'        # Logo 文件名
logoSize: ''                 # Logo 尺寸，空为原始
titleFont: 'Title.ttf'       # 顶部标题字体
titleFontSize: ''            # 顶部标题字号，空为默认
secondaryTitleFont: 'Secondary_Title.ttf'
secondaryTitleFontSize: ''
contentFont: 'Content.ttf'
contentFontSize: ''
hotModule: 'douyin'          # 热搜板块：douyin / bangumi
apiBase:
  bangumi: 'https://api.bgm.tv'
  viki: 'https://60s.viki.moe'
theme: 'blue'                # 主题：blue（芙芙蓝色） / pink（真寻粉色）
```
修改后会在几秒内自动重载，无需重启。

提示：安装 Guoba-Plugin 后，可在 “插件配置” 中直接管理以上所有字段。


##　📁 文件结构

```text
furina-daily
├── apps
│   ├── daily.js                # 定时推送、命令响应主逻辑
│   ├── help.js                 # 帮助菜单生成与缓存
│   └── update.js               # 插件自更新
├── config
│   └── default_config
│       └── daily.yaml          # 默认配置模板（含所有字段）
├── guoba
│   ├── configInfo.js           # 锅巴配置读写桥接（支持 apiBase、theme 等）
│   ├── index.js                # 锅巴入口
│   ├── pluginInfo.js           # 锅巴插件信息
│   └── schemas
│       ├── daily.js            # 日报配置表单（含热搜、主题、API地址）
│       └── index.js            # Schema 汇总
├── guoba.support.js            # 锅巴插件注册
├── index.js                    # 插件入口
├── package.json
├── resources
│   ├── font
│   │   ├── Content.ttf         # 正文字体
│   │   ├── Secondary_Title.ttf # 内容标题字体
│   │   └── Title.ttf           # 主标题字体
│   ├── html
│   │   ├── base.html           # 蓝色主题主骨架
│   │   ├── base_pink.html      # 粉色主题主骨架（与base布局一致）
│   │   ├── css
│   │   │   ├── daily.css       # 蓝色主题样式
│   │   │   └── daily-pink.css  # 粉色主题样式
│   │   └── partials            # 模块子模板（共用）
│   │       ├── head.html
│   │       ├── header.html
│   │       ├── moyu.html
│   │       ├── bilibili.html
│   │       ├── bangumi.html    # 新番模块
│   │       ├── douyin.html
│   │       ├── news.html
│   │       └── footer.html
│   ├── images
│   │   ├── logo.png            # 日报 Logo
│   │   └── furina.png          # 芙宁娜图标（帮助用）
│   └── svg                     # 模块图标
│       ├── calendar.svg
│       ├── bilibili.svg
│       ├── douyin.svg
│       ├── it.svg
│       └── news.svg
└── src
    ├── dataFetcher.js          # 数据聚合调度（传递 config）
    ├── index.js                # Puppeteer 渲染，根据 theme 选择模板
    ├── fetchers                # 各 API 数据获取（支持自定义 base）
    │   ├── news60s.js
    │   ├── moyu.js
    │   ├── bilibili.js
    │   ├── bangumi.js          # Bangumi 新番抓取（使用 apiBase.bangumi）
    │   ├── douyin.js
    │   ├── itNews.js
    │   └── quote.js
    ├── mock                    # 模拟数据（API 失败时使用）
    │   ├── news60s.js
    │   ├── moyu.js
    │   ├── bilibili.js
    │   ├── douyin.js
    │   ├── itNews.js
    │   └── quote.js
    └── utils
        ├── date.js             # 农历与日期工具
        ├── format.js           # 数值格式化
        └── logger.js           # 统一日志
```

## 📄致谢

- **灵感来源**：[`nonebot-plugin-zxreport`](https://github.com/HibiKier/nonebot-plugin-zxreport)—— 可爱的小真寻记者为你献上今日报道！
- **60s API**：[`vikiboss/60s`](https://github.com/vikiboss/60s) —— 提供新闻、摸鱼、热搜等数据
- **Bangumi API**：[`bangumi/api`](https://github.com/bangumi/api) —— 提供番剧日历与剧集数据

## 📄 License
本项目使用 [AGPL-3.0 license]许可证。
请注意资源目录中的字体版权，需自行替换为可商用字体或获取授权。