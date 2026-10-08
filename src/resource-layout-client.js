import { createElement as h, useState } from 'react'
import { withBlockMove } from './resource-layout.js'

/** Current resources are rendered separately from reusable source configuration. */
export function ResourceLayoutEditor({ preset, preview, locale = 0, busy, onChange, onPreview }) {
  const [drag, setDrag] = useState(null), [error, setError] = useState('')
  const t = (zh, en) => locale === 0 ? zh : en
  const terms = { 'native-system': '原生指令', history: '原生历史', input: '本步输入', worldbook: '世界书', character: '角色卡', description: '角色描述', before: '前置组', after: '后置组', depth: '深度组', preserve: '保留原身份', free: '自由块', slot: '插槽绑定', runtime: '运行时管理', request: '每轮重新装配', snapshot: '留存快照', native: '原生留存', 'source-defined': '按来源顺序', 'before-input:pre-step': '输入前投递', 'after-input:pre-step': '输入后投递', 'after-input:context': '原生 context', system: 'system', user: 'user', assistant: 'assistant' }
  const label = value => locale === 0 ? terms[value] ?? value : value
  const blockName = block => block.name.split(' · ').map(label).join(' · ')
  const layout = preview?.resourceLayout
  const update = patch => onChange({ ...preset, layout: { ...preset.layout, ...patch } })
  const move = (target, anchor, side, detach = false) => {
    try { setError(''); onChange(withBlockMove(preset, layout, target, anchor, side, detach)) } catch (e) { setError(e.message) }
  }
  return h('section', { className: 'dta-resource-layout', 'aria-label': t('当前资源布局', 'Current resource layout') },
    h('h3', null, t('装配策略', 'Assembly policy')),
    !preset.layout ? h('div', { className: 'dta-notice' }, t('兼容模式：保留已保存策略的顺序、身份与投递行为。采用新策略后请预览并保存；不会自动修改已应用策略。', 'Compatibility mode preserves saved ordering, identity and delivery. Adopt, preview and save explicitly; applied strategies are unchanged.'),
      h('button', { disabled: busy, onClick: () => update({ version: 1, source: ['st', 'native-slots', 'native-roles'].includes(preset.placement) ? 'preset-slots' : 'manual', identity: preset.placement === 'native-slots' ? 'position' : 'preserve', fallback: 'source-order', overrides: [] }) }, t('采用资源布局策略', 'Adopt resource layout policy')))
      : h('div', { className: 'dta-resource-policy' },
        ...[
          ['source', t('布局来源', 'Layout source'), [['manual', t('手动', 'Manual')], ['preset-slots', t('预设插槽', 'Preset slots')]]],
          ['identity', t('身份处理', 'Identity'), [['preserve', t('保留来源身份', 'Preserve source roles')], ['position', t('明确允许按位置适配', 'Allow position adaptation')]]],
          ['fallback', t('缺失定位', 'Missing targets'), [['source-order', t('来源顺序并诊断', 'Source order with diagnostic')], ['error', t('拒绝装配', 'Reject assembly')]]],
        ].map(([key, label, options]) => h('label', { key }, label, h('select', { value: preset.layout[key], disabled: busy, onChange: e => update({ [key]: e.target.value }) }, ...options.map(([value, label]) => h('option', { key: value, value }, label)))))),
    h('h3', null, t('当前资源布局', 'Current resource layout')),
    h('p', null, t('来源提供内容；块是连续输出；插槽只占位置。拖动整块保留其内部顺序。修改后需刷新预览。', 'Sources supply content; blocks are contiguous output; slots are positions only. Dragging moves the entire block and preserves internal order. Refresh after editing.')),
    h('button', { disabled: busy, onClick: onPreview }, t('刷新当前资源', 'Refresh current resources')),
    error && h('p', { role: 'alert' }, error),
    !layout ? h('p', null, t('预览以解析当前资源及限制。', 'Preview to resolve current resources and constraints.')) : h('div', { className: 'dta-resource-blocks' },
      ...layout.blocks.map((b, i) => h('article', { key: b.id, className: 'dta-row', 'data-resource-block': b.id },
        h('div', { className: 'dta-summary' },
          h('button', { type: 'button', className: 'dta-handle', disabled: busy || !preset.layout || !b.movable, 'aria-label': `${t('移动整块', 'Move whole block')}: ${blockName(b)}`,
            onPointerDown: e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setDrag(b.id) },
            onPointerUp: e => { if (!e.currentTarget.hasPointerCapture(e.pointerId)) return; e.currentTarget.releasePointerCapture(e.pointerId); const row = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-resource-block]'); if (row && drag !== row.dataset.resourceBlock) move(drag, row.dataset.resourceBlock, e.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2 ? 'before' : 'after'); setDrag(null) }, onPointerCancel: () => setDrag(null) }, b.movable ? '⠿' : '🔒'),
          h('strong', null, `${i + 1}. ${blockName(b)}`), h('small', null, `${b.originalRoles.map(label).join('/')} → ${b.effectiveRoles.map(label).join('/')} · ${label(b.region)} · ${label(b.binding)}`)),
        h('div', { className: 'dta-resource-body' },
        h('small', null, `${t('留存', 'Retention')}: ${b.retention.map(label).join('/')} · ${b.reason === 'user-override' ? t('用户自定义位置', 'User position override') : b.slotId ? t('来源插槽决定位置', 'Source slot owns position') : t('来源默认顺序', 'Source default order')}`),
        b.slotId && h('p', null, `${t('跟随插槽', 'Follows slot')}: ${b.slotId}`),
        ...b.limitations.map(reason => h('p', { key: reason, className: 'dta-notice' }, reason === 'NATIVE_CONTEXT_REUSES_HISTORY_POSITION' ? t('原生 context 可能复用历史中的旧位置；此处顺序仅表示新快照的位置，精确位置以实际请求为准。', 'Native context can reuse an earlier history position. This order describes new snapshots; actual requests determine exact placement.') : t('原生历史、深度或留存快照的位置由运行时约束。', 'Native history, depth or retained snapshots constrain this position.'))),
        h('details', null, h('summary', null, `${t('内容与来源', 'Content and provenance')} · ${b.entries.length} · ${label(b.internalOrder)}`), ...b.entries.map(entry => h('div', { key: entry.id, className: 'dta-child' }, h('small', null, `${entry.source?.module} / ${entry.source?.resourceId ?? ''} / ${entry.source?.field} · ${entry.originalRole} → ${entry.effectiveRole} · ${label(entry.lifetime)}`), h('pre', null, entry.text), ...(entry.children ?? []).map((child, index) => h('pre', { key: index }, `${child.source?.module ?? ''} / ${child.source?.field ?? ''}\n${child.text ?? ''}`))))),
        preset.layout && (b.movable || b.overridable) && h('label', null, b.overridable ? t('明确覆盖插槽：移到…之前', 'Override slot: move before…') : t('整块移到…之前', 'Move whole block before…'), h('select', { value: '', disabled: busy, onChange: e => { if (e.target.value) move(b.id, e.target.value, 'before', b.overridable) } }, h('option', { value: '' }, t('选择目标', 'Choose target')), ...layout.blocks.filter(a => a.id !== b.id).map(a => h('option', { key: a.id, value: a.id }, blockName(a)))))))),
      h('details', null, h('summary', null, t('插槽（不发送文本）', 'Slots (no emitted text)')), ...layout.slots.map(s => h('p', { key: s.id }, `${s.id} → ${s.targetSourceId} ${s.group ?? ''} · ${s.duplicate ? t('重复，未重复发送', 'duplicate, no duplicate output') : s.nodeIds.length ? t('已绑定', 'bound') : t('空插槽', 'empty')}`))),
      ...((preview.diagnostics ?? []).filter(d => d.code.startsWith('LAYOUT_')).map((d, i) => h('pre', { key: i, role: 'status' }, JSON.stringify(d)))),
    ),
    preset.layout?.overrides.length > 0 && h('details', null, h('summary', null, t('保存的定位覆盖', 'Saved position overrides')), ...preset.layout.overrides.map((o, i) => h('div', { key: o.target, className: 'dta-layout-override' }, h('code', null, `${layout?.blocks.find(b => b.id === o.target)?.name ?? t('待解析块', 'Unresolved block')} → ${o.side} ${layout?.blocks.find(b => b.id === o.anchor)?.name ?? t('待解析目标', 'Unresolved target')}`), h('button', { disabled: busy, onClick: () => update({ overrides: preset.layout.overrides.filter((_, at) => at !== i) }) }, t('恢复来源位置', 'Restore source position')))))
  )
}
