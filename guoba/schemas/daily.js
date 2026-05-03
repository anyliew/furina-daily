export default [
  {
    field: 'reportGroup',
    label: '日报推送群',
    component: 'GTags',
    bottomHelpMessage: '需要接收日报的QQ群号列表，输入后按回车添加。',
    componentProps: {
      placeholder: '请输入群号，按回车确认',
      allowAdd: true,
      allowDel: true
    }
  },
  {
    field: 'morningTime',
    label: '早间推送时间',
    component: 'Input',
    bottomHelpMessage: 'Cron 表达式，默认 0 10 * * *（每天10:00）',
    componentProps: {
      placeholder: '0 10 * * *'
    }
  },
  {
    field: 'eveningTime',
    label: '晚间推送时间',
    component: 'Input',
    bottomHelpMessage: 'Cron 表达式，默认 0 22 * * *（每天22:00）',
    componentProps: {
      placeholder: '0 22 * * *'
    }
  }
];