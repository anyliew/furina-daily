// guoba/schemas/index.js
//
// 锅巴配置面板按「分类 = Tab」组织，与 yenai-plugin 的做法一致：
// 每个分类一个文件，文件内首项为 SOFT_GROUP_BEGIN 标记（开启一个新 Tab），
// 组内再用 Divider 分小节。所有字段最终仍是同一个 config/config/daily.yaml。
import push from './push.js'
import appearance from './appearance.js'
import content from './content.js'
import image from './image.js'
import api from './api.js'
import other from './other.js'

export const schemas = [
  ...push,        // 推送配置
  ...appearance,  // 外观配置
  ...content,     // 内容配置
  ...image,       // 图片配置
  ...api,         // 数据源配置
  ...other        // 其他配置
]
