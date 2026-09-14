// guoba/schemas/other.js
// 其他配置：配置维护类开关
export default [
  {
    component: 'SOFT_GROUP_BEGIN',
    label: '其他配置'
  },
  {
    component: 'Divider',
    label: '配置维护'
  },
  {
    field: 'autoMerge',
    label: '自动合并默认配置新增项',
    component: 'Switch',
    bottomHelpMessage: '插件更新后若默认配置新增了字段，重启时会自动把这些新字段合并进用户配置（config/config/daily.yaml），不会覆盖你已设置的值。关闭后需自行对比默认配置手动补齐。'
  }
]
