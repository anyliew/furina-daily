// guoba/schemas/push.js
// 推送配置：推送群 与 早晚定时推送时间
export default [
  {
    component: 'SOFT_GROUP_BEGIN',
    label: '推送配置'
  },
  {
    component: 'Divider',
    label: '推送目标'
  },
  {
    field: 'reportGroup',
    label: '日报推送群',
    component: 'GSelectGroup',
    bottomHelpMessage: '从机器人群列表中选择需要接收日报的群（支持搜索群名 / 群号），也可直接输入群号后回车。指令「开启日报推送 / 关闭日报推送」可在群内快速增减。',
    componentProps: {
      placeholder: '请选择推送群，或直接输入群号'
    }
  },
  {
    component: 'Divider',
    label: '推送时间'
  },
  {
    field: 'morningTime',
    label: '早间推送时间',
    component: 'EasyCron',
    bottomHelpMessage: 'Cron 表达式，默认 0 10 * * *（每天 10:00）。可从预设中选择，也可直接输入，输入框下方会显示人类可读的释义。',
    componentProps: {
      placeholder: '0 10 * * *'
    }
  },
  {
    field: 'eveningTime',
    label: '晚间推送时间',
    component: 'EasyCron',
    bottomHelpMessage: 'Cron 表达式，默认 0 22 * * *（每天 22:00）。',
    componentProps: {
      placeholder: '0 22 * * *'
    }
  }
]
