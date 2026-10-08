import { createElement as h, useState } from 'react'
import { configurePosition, positionRows, priorityOrder } from './resource-positions.js'

/** Configuration comes from provider capabilities, never from activated preview blocks. */
export function ResourcePositionEditor({ preset, sources, locale = 0, busy, onChange, sourceColor, originName, sourceName = id => sources.find(s => s.id === id)?.name ?? id }) {
  const [drag, setDrag] = useState(null), [drop, setDrop] = useState(null), [priorityDrop, setPriorityDrop] = useState(null)
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
  const priorityTarget = e => {
    const row = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-priority]')
    if (!row || !e.currentTarget.closest('.dta-priorities')?.contains(row)) return null
    const before = e.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2
    return { id: row.dataset.priority, before }
  }
  const fixed = row => ['native-system', 'history', 'input'].includes(row.sourceId)
  const update = (row, patch, before) => onChange(configurePosition(preset, sources, row.key, patch, before))
  const title = row => row.source.positions ? row.position.name[locale] ?? row.position.name[0] : sourceName(row.sourceId)
  const destination = e => {
    const row = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-position-key]')
    if (!row || !e.currentTarget.closest('.dta-position-list')?.contains(row)) return null
    const key = row.dataset.positionKey, index = rows.findIndex(r => r.key === key)
    return { key, before: e.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2, index }
  }
  return h('section', { className: 'dta-resource-layout', 'aria-label': t('资源位置配置', 'Resource positions') },
    h('p', null, t('配置所有可能提供内容的位置，不需要先加载具体资源。宏引用和插槽归属在装配时解析；空位置也保留在此清单。', 'Configure every potential content position without loading assets. Macros and slots resolve during assembly; empty positions remain in this list.')),
    !preset.layout && h('p', { className: 'dta-notice' }, t('当前策略保留原有行为；第一次修改位置或冲突规则时采用资源位置配置。', 'The strategy keeps its existing behavior until you edit a position or conflict policy.')),
    h('h3', null, t('冲突处理优先级', 'Conflict priority')),
    h('p', null, t('从上到下依次优先。拖动规则可自由排序；只有发生位置冲突时才比较优先级。', 'Higher rules win. Drag rules to set any order; priority is compared only when positions conflict.')),
    h('div', { className: 'dta-priorities', 'aria-label': t('冲突优先级列表', 'Conflict priority list') }, ...priorities.map((id, index) => h('div', { key: id, className: 'dta-priority-row', 'data-priority': id, 'data-drop-side': priorityDrop?.id === id ? priorityDrop.before ? 'before' : 'after' : undefined },
      h('button', { type: 'button', className: 'dta-handle', disabled: busy, 'aria-label': `${t('拖动优先级', 'Drag priority')}: ${priorityNames[id]}`,
        onPointerDown: e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId) },
        onPointerMove: e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) setPriorityDrop(priorityTarget(e)) },
        onPointerUp: e => { if (!e.currentTarget.hasPointerCapture(e.pointerId)) return; const target = priorityTarget(e); e.currentTarget.releasePointerCapture(e.pointerId); if (target && target.id !== id) movePriority(id, target.before ? target.id : priorities[priorities.indexOf(target.id) + 1] ?? null); setPriorityDrop(null) },
        onPointerCancel: () => setPriorityDrop(null), onLostPointerCapture: () => setPriorityDrop(null) }, '⠿'),
      h('span', null, `${index + 1}. ${priorityNames[id]}`),
      h('button', { disabled: busy || index === 0, 'aria-label': `${t('提高优先级', 'Raise priority')}: ${priorityNames[id]}`, onClick: () => movePriority(id, priorities[index - 1]) }, '↑'),
      h('button', { disabled: busy || index === priorities.length - 1, 'aria-label': `${t('降低优先级', 'Lower priority')}: ${priorityNames[id]}`, onClick: () => movePriority(id, priorities[index + 2] ?? null) }, '↓')))),
    h('div', { className: 'dta-resource-policy' },
      h('label', null, t('身份处理', 'Identity'), h('select', { disabled: busy, value: policy.identity, onChange: e => changePolicy({ identity: e.target.value }) }, h('option', { value: 'preserve' }, t('保留来源身份', 'Preserve source roles')), h('option', { value: 'position' }, t('允许按位置适配', 'Allow position adaptation')))),
      h('label', null, t('缺失定位', 'Missing targets'), h('select', { disabled: busy, value: policy.fallback, onChange: e => changePolicy({ fallback: e.target.value }) }, h('option', { value: 'source-order' }, t('回退并说明原因', 'Fall back with explanation')), h('option', { value: 'error' }, t('拒绝装配', 'Reject assembly'))))),
    h('small', null, t('原生历史、工具事务和留存边界始终由 DSH 管理。关闭位置会排除该位置的内容；拖动或上下移动设置用户排列。', 'DSH always owns native history, tool transactions and retention boundaries. Turning a position off excludes its content; dragging or moving up/down sets user order.')),
    preset.layout?.overrides.length > 0 && h('div', { className: 'dta-notice' }, t('此策略还含有旧的具体资源定位。可先在结果页检查；清除后仅使用这里的通用位置配置。', 'This strategy also contains older asset-specific overrides. Inspect the result before clearing them to use only reusable positions.'), h('button', { disabled: busy, onClick: () => changePolicy({ overrides: [] }) }, t('清除旧资源定位', 'Clear asset-specific overrides'))),
    h('div', { className: 'dta-position-list' }, ...rows.map((row, index) => h('article', { key: row.key, className: 'dta-position-row', 'data-position-key': row.key, 'data-drop-side': drop?.key === row.key ? drop.before ? 'before' : 'after' : undefined, 'data-resource-dragging': drag === row.key, style: { '--assembly-color': sourceColor(row.source.pluginId) } },
      h('div', { className: 'dta-position-summary' },
        h('button', { className: 'dta-handle', type: 'button', disabled: busy || fixed(row) || row.missing || row.position.configurable === false, 'aria-label': `${t('移动位置', 'Move position')}: ${title(row)}`,
          onPointerDown: e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setDrag(row.key) },
          onPointerMove: e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) setDrop(destination(e)) },
          onPointerUp: e => { if (!e.currentTarget.hasPointerCapture(e.pointerId)) return; const target = destination(e); e.currentTarget.releasePointerCapture(e.pointerId); if (target && target.key !== row.key) update(row, {}, target.before ? target.key : rows[target.index + 1]?.key ?? null); setDrag(null); setDrop(null) },
          onPointerCancel: () => { setDrag(null); setDrop(null) }, onLostPointerCapture: () => { setDrag(null); setDrop(null) } }, fixed(row) ? '🔒' : '⠿'),
        h('input', { type: 'checkbox', checked: row.enabled, disabled: busy || row.missing || row.position.configurable === false || preset.backend === 'native' && ['history', 'input'].includes(row.sourceId), 'aria-label': `${t('启用位置', 'Enable position')}: ${title(row)}`, onChange: e => update(row, { enabled: e.target.checked }) }),
        h('div', null, h('strong', null, title(row)), h('small', { className: 'dta-origin' }, `${originName(row.source.pluginId)} · ${sourceName(row.sourceId)}`))),
      h('div', { className: 'dta-position-body' },
        row.position.macros?.length > 0 && h('small', null, `${t('预设宏 / 插槽', 'Preset macros / slots')}: ${row.position.macros.map(m => `{{${m}}}`).join(' · ')}`),
        h('small', null, row.missing ? t('来源未注册；保留配置，装配时按缺失定位规则处理。', 'Provider unavailable; configuration is retained and uses the missing-target policy.') : row.source.moduleAvailable === false ? t('当前没有可用内容；配置仍可保存，资源可用后生效。', 'No content is currently available; save the policy for when resources become available.') : fixed(row) ? t('位置由运行时管理', 'Position managed by runtime') : row.placement === 'list' ? t('用户排列；冲突时采用上方优先级', 'User order; conflicts use the selected priority') : t('跟随预设插槽或资源自身位置', 'Follow preset slots or resource-defined position')),
        row.position.note && h('small', null, row.position.note[locale]),
        !fixed(row) && row.position.configurable !== false && h('div', { className: 'dta-position-actions' },
          h('button', { disabled: busy || index === 0 || row.missing, onClick: () => update(row, {}, rows[index - 1].key), 'aria-label': `${t('上移', 'Move up')}: ${title(row)}` }, t('上移', 'Up')),
          h('button', { disabled: busy || index === rows.length - 1 || row.missing, onClick: () => update(row, {}, rows[index + 2]?.key ?? null), 'aria-label': `${t('下移', 'Move down')}: ${title(row)}` }, t('下移', 'Down')),
          row.placement === 'list' && h('button', { disabled: busy, onClick: () => update(row, { placement: 'source' }) }, t('跟随资源位置', 'Follow source position')))))))
  )
}
export function PositionDecisions({ preview, sources, locale = 0, sourceName = id => sources.find(s => s.id === id)?.name ?? id }) {
  const t = (zh, en) => locale === 0 ? zh : en
  const names = { user: t('采用用户排列', 'User order applied'), preset: t('采用预设插槽', 'Preset slot applied'), runtime: t('服从 DSH 运行时约束', 'DSH runtime constraint wins'), 'resource-depth': t('采用资源深度', 'Resource depth applied'), source: t('采用资源默认位置', 'Source position applied'), default: t('来源默认顺序优先', 'Default source order wins'), resource: t('资源自带位置优先', 'Resource position wins'), unavailable: t('来源或位置未注册，已回退', 'Provider/position unavailable; fallback applied'), disabled: t('已关闭，不进入结果', 'Disabled; excluded') }
  const decisions = preview?.resourceLayout?.positionDecisions ?? []
  const unique = [...new Map(decisions.map(d => [`${d.sourceId}/${d.positionId}/${d.decision}`, d])).values()]
  return unique.length > 0 && h('details', { className: 'dta-position-decisions', open: true }, h('summary', null, t('位置与冲突处理结果', 'Position and conflict decisions')), preview.resourceLayout.priorityOrder && h('p', null, `${t('本次优先级', 'Priority used')}: ${preview.resourceLayout.priorityOrder.map(p => ({ user: t('用户位置', 'User'), preset: t('预设插槽', 'Preset'), resource: t('资源位置', 'Resource'), default: t('来源默认', 'Default') })[p]).join(' → ')}`), h('ul', null, ...unique.map((d, i) => {
    const source = sources.find(s => s.id === d.sourceId), position = source?.positions?.find(p => p.id === d.positionId)
    return h('li', { key: i }, `${position?.name?.[locale] ?? sourceName(d.sourceId)}: ${names[d.decision] ?? d.decision}${d.code === 'POSITION_ANCHOR_MISSING' ? t('（资源锚点不可用）', ' (resource anchor unavailable)') : d.requested ? t('（用户排列与此规则冲突）', ' (overrides the requested user order)') : ''}`)
  })))
}
