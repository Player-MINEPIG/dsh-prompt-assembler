import { createElement as h } from 'react'
import { SortableList } from './sortable-list.js'
import { configurePosition, positionRows, priorityOrder } from './resource-positions.js'

/** Configuration comes from provider capabilities, never from activated preview blocks. */
export function ResourcePositionEditor({ preset, sources, locale = 0, busy, onChange, sourceColor, originName, sourceName = id => sources.find(s => s.id === id)?.name ?? id }) {
  const t = (zh, en) => locale === 0 ? zh : en
  const rows = positionRows(preset, sources)
  const policy = preset.layout ?? { version: 1, source: 'preset-slots', priority: ['user', 'preset', 'resource', 'default'], identity: 'preserve', fallback: 'source-order', overrides: [] }
  const changePolicy = patch => onChange({ ...preset, layout: { ...policy, ...patch, ...(patch.priority ? { source: 'preset-slots' } : {}) } })
  const priorities = priorityOrder({ layout: policy })
  const priorityNames = { user: t('用户位置配置', 'User position configuration'), preset: t('预设插槽与宏引用', 'Preset slots and macro references'), resource: t('资源自带位置与深度', 'Resource position and depth'), default: t('来源默认顺序', 'Default source order') }
  const movePriority = (id, before) => {
    if (id === before) return
    const next = priorities.filter(p => p !== id), at = before == null ? next.length : next.indexOf(before)
    if (at < 0) return
    next.splice(at, 0, id); changePolicy({ priority: next })
  }
  const fixed = row => ['native-system', 'history', 'input'].includes(row.sourceId)
  const update = (row, patch, before) => onChange(configurePosition(preset, sources, row.key, patch, before))
  const title = row => row.source.positions ? row.position.name[locale] ?? row.position.name[0] : sourceName(row.sourceId)
  return h('section', { className: 'dta-resource-layout', 'aria-label': t('资源位置配置', 'Resource positions') },
    h('p', null, t('配置所有可能提供内容的位置，不需要先加载具体资源。宏引用和插槽归属在装配时解析；空位置也保留在此清单。', 'Configure every potential content position without loading assets. Macros and slots resolve during assembly; empty positions remain in this list.')),
    !preset.layout && h('p', { className: 'dta-notice' }, t('当前策略保留原有行为；第一次修改位置或排序策略时采用资源位置配置。', 'The strategy keeps its existing behavior until you edit a position or sorting policy.')),
    h('h3', null, t('排序优先级', 'Sorting priority')),
    h('p', null, t('从上到下逐个使用排序策略。已由前一策略排好的资源不再参与后续排序；后续策略只处理剩余资源。拖动手柄调整策略顺序。', 'Apply strategies from top to bottom. Each strategy sorts only the remaining resources; resources already placed are excluded from later passes. Drag the handles to reorder strategies.')),
    h(SortableList, { className: 'dta-priorities', label: t('排序优先级列表', 'Sorting priority list'), items: priorities, itemKey: id => id, itemName: id => priorityNames[id], handleLabel: t('拖动优先级', 'Drag priority'), busy, locale, onMove: movePriority,
      renderItem: (id, index, handle) => h('div', { className: 'dta-priority-row', 'data-priority': id }, handle, h('span', null, `${index + 1}. ${priorityNames[id]}`)) }),
    h('div', { className: 'dta-resource-policy' },
      h('label', null, t('身份处理', 'Identity'), h('select', { disabled: busy, value: policy.identity, onChange: e => changePolicy({ identity: e.target.value }) }, h('option', { value: 'preserve' }, t('保留来源身份', 'Preserve source roles')), h('option', { value: 'position' }, t('允许按位置适配', 'Allow position adaptation')))),
      h('label', null, t('缺失定位', 'Missing targets'), h('select', { disabled: busy, value: policy.fallback, onChange: e => changePolicy({ fallback: e.target.value }) }, h('option', { value: 'source-order' }, t('回退并说明原因', 'Fall back with explanation')), h('option', { value: 'error' }, t('拒绝装配', 'Reject assembly'))))),
    h('small', null, t('原生历史、工具事务和留存边界始终由 DSH 管理。关闭位置会排除该位置的内容；拖动设置用户排列。', 'DSH always owns native history, tool transactions and retention boundaries. Turning a position off excludes its content; dragging sets user order.')),
    preset.layout?.overrides.length > 0 && h('div', { className: 'dta-notice' }, t('此策略还含有旧的具体资源定位。可先在结果页检查；清除后仅使用这里的通用位置配置。', 'This strategy also contains older asset-specific overrides. Inspect the result before clearing them to use only reusable positions.'), h('button', { disabled: busy, onClick: () => changePolicy({ overrides: [] }) }, t('清除旧资源定位', 'Clear asset-specific overrides'))),
    h(SortableList, { className: 'dta-position-list', items: rows, itemKey: row => row.key, itemName: title, handleLabel: t('移动位置', 'Move position'), busy, locale,
      canMove: row => !fixed(row) && !row.missing && row.position.configurable !== false,
      onMove: (row, before) => update(row, {}, before?.key ?? null),
      renderItem: (row, index, handle) => h('article', { className: 'dta-position-row', 'data-position-key': row.key, style: { '--assembly-color': sourceColor(row.source.pluginId) } },
      h('div', { className: 'dta-position-summary' }, handle,
        h('input', { type: 'checkbox', checked: row.enabled, disabled: busy || row.missing || row.position.configurable === false || preset.backend === 'native' && ['history', 'input'].includes(row.sourceId), 'aria-label': `${t('启用位置', 'Enable position')}: ${title(row)}`, onChange: e => update(row, { enabled: e.target.checked }) }),
        h('div', null, h('strong', null, title(row)), h('small', { className: 'dta-origin' }, `${originName(row.source.pluginId)} · ${sourceName(row.sourceId)}`))),
      h('div', { className: 'dta-position-body' },
        h('small', { className: 'dta-position-stability' }, `${t('稳定性', 'Stability')}: ${row.sourceId === 'worldbook' ? t('常驻条目随资源修改而变化；其他条目可能随对话触发变化。', 'Constant entries change with assets; other entries may change with conversation activation.') : ({ asset: t('源正文随资源修改变化；宏和引用内容可能随请求变化。', 'Source text changes with asset edits; macros and referenced content may change per request.'), conversation: t('可能随对话变化', 'May change with conversation'), evaluation: t('每次求值可能变化', 'May change on each evaluation'), assembly: t('由官方装配决定', 'Determined by native assembly'), snapshot: t('已保存的快照', 'Saved snapshot') })[row.source.stability] ?? t('来源未声明', 'Not declared by the provider')}`),
        row.position.macros?.length > 0 && h('small', null, `${t('预设宏 / 插槽', 'Preset macros / slots')}: ${row.position.macros.map(m => `{{${m}}}`).join(' · ')}`),
        h('small', null, row.missing ? t('来源未注册；保留配置，装配时按缺失定位规则处理。', 'Provider unavailable; configuration is retained and uses the missing-target policy.') : row.source.moduleAvailable === false ? t('当前没有可用内容；配置仍可保存，资源可用后生效。', 'No content is currently available; save the policy for when resources become available.') : fixed(row) ? t('位置由运行时管理', 'Position managed by runtime') : row.placement === 'list' ? t('用户排列；轮到该策略时只排列尚未定位的资源', 'User order; applied only to resources not placed by an earlier strategy') : t('跟随预设插槽或资源自身位置', 'Follow preset slots or resource-defined position')),
        row.position.note && h('small', null, row.position.note[locale]),
        !fixed(row) && row.position.configurable !== false && row.placement === 'list' && h('div', { className: 'dta-position-actions' },
          row.placement === 'list' && h('button', { disabled: busy, onClick: () => update(row, { placement: 'source' }) }, t('跟随资源位置', 'Follow source position'))))) })
  )
}
export function PositionDecisions({ preview, sources, locale = 0, sourceName = id => sources.find(s => s.id === id)?.name ?? id }) {
  const t = (zh, en) => locale === 0 ? zh : en
  const names = { user: t('采用用户排列', 'User order applied'), preset: t('采用预设插槽', 'Preset slot applied'), runtime: t('服从 DSH 运行时约束', 'DSH runtime constraint wins'), 'resource-depth': t('采用资源深度', 'Resource depth applied'), source: t('采用资源默认位置', 'Source position applied'), default: t('由来源默认顺序排列', 'Default source order applied'), resource: t('由资源自带位置排列', 'Resource position applied'), unavailable: t('来源或位置未注册，已回退', 'Provider/position unavailable; fallback applied'), disabled: t('已关闭，不进入结果', 'Disabled; excluded') }
  const decisions = preview?.resourceLayout?.positionDecisions ?? []
  const unique = [...new Map(decisions.map(d => [`${d.sourceId}/${d.positionId}/${d.decision}`, d])).values()]
  return unique.length > 0 && h('details', { className: 'dta-position-decisions', open: true }, h('summary', null, t('排序处理结果', 'Sorting decisions')), preview.resourceLayout.priorityOrder && h('p', null, `${t('本次排序顺序', 'Priority used')}: ${preview.resourceLayout.priorityOrder.map(p => ({ user: t('用户位置', 'User'), preset: t('预设插槽', 'Preset'), resource: t('资源位置', 'Resource'), default: t('来源默认', 'Default') })[p]).join(' → ')}`), preview.resourceLayout.sortingStages?.length > 0 && h('ol', { className: 'dta-sorting-stages' }, ...preview.resourceLayout.sortingStages.map(stage => h('li', { key: stage.strategy }, `${({ user: t('用户排列', 'User order'), preset: t('预设插槽', 'Preset slots'), resource: t('资源位置', 'Resource positions'), default: t('来源默认', 'Default order') })[stage.strategy]}: ${t('定位', 'Placed')} ${stage.nodeIds.length} ${t('项，后续策略跳过这些资源', 'items; later strategies skip these resources')}`))), h('ul', null, ...unique.map((d, i) => {
    const source = sources.find(s => s.id === d.sourceId), position = source?.positions?.find(p => p.id === d.positionId)
    return h('li', { key: i }, `${position?.name?.[locale] ?? sourceName(d.sourceId)}: ${names[d.decision] ?? d.decision}${d.code === 'POSITION_ANCHOR_MISSING' ? t('（资源锚点不可用）', ' (resource anchor unavailable)') : d.requested ? t('（该资源已由此前策略或运行时定位）', ' (already placed by an earlier strategy or runtime)') : ''}`)
  })))
}
