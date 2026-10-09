import { createElement as h } from 'react'

/** Keep the original diagnostic available, but lead with a recovery action. */
export function AssemblyError({ message, locale = 0, context, ...attributes }) {
  const zh = locale === 0
  const priority = String(message).includes('Invalid position priority order')
  const strategy = String(message).includes('Position strategy unavailable:')
  const network = /Failed to fetch|fetch failed|NetworkError|HTTP 50[234]/i.test(String(message))
  const title = strategy ? (zh ? '所需排序策略未注册' : 'A required ordering strategy is unavailable') : priority
    ? (zh ? '自动定位优先级格式不兼容或不完整' : 'Automatic placement priorities are incompatible or incomplete')
    : network ? (zh ? '无法连接装配服务' : 'Could not reach the assembly service')
      : (zh ? '装配操作未完成' : 'Assembly operation could not be completed')
  const remedy = strategy ? (zh ? '请重新启用提供此排序策略的插件，或在资源位置页移除标为“未注册”的策略；然后重新预览并应用。已保存的规则和会话选择仍然保留。' : 'Enable the plugin that provides this algorithm, or remove the unavailable strategy in Resource positions. Then preview and apply again. Saved rules and session selections are retained.') : priority
    ? (zh ? '请刷新页面后重新选择内置策略。若内置策略仍报错，请同步更新 Tavern 与 Assembler 并重启后端，再刷新页面；若仅自定义策略报错，请从正常的内置策略另存为副本，再重新设置位置。' : 'Refresh the page and select a built-in strategy again. If built-ins still fail, update both Tavern and Assembler, restart the backend, and refresh. If only a custom strategy fails, save a copy of a working built-in and configure its positions again.')
    : network ? (zh ? '请确认测试环境后端正在运行，刷新页面后重试。' : 'Check that the backend is running, then refresh the page and retry.')
      : (zh ? '请展开错误详情，检查对应的策略或资源设置；修改后点击“装配结果”重新校验，通过后再应用。若内置策略也失败，请反馈所选策略名称和错误详情。' : 'Expand the error details and check the relevant strategy or resource settings. After editing, click “Assembly result” to validate before applying. If a built-in also fails, report its name and the error details.')
  return h('div', { ...attributes, role: 'alert', className: 'dta-notice', 'data-error': true },
    context && h('p', null, context), h('strong', null, title), h('p', null, remedy),
    h('details', null, h('summary', null, zh ? '错误详情' : 'Error details'), h('pre', null, String(message))))
}
