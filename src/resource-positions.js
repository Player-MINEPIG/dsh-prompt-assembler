import { isContextControl } from './native-context.js'
/** Source-declared positions describe capabilities, not the current activated assets. */
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,159}$/
export function normalizePositions(value) {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > 512) throw new TypeError('Expected at most 512 resource positions')
  const seen = new Set()
  return value.map(p => {
    const key = positionKey(p?.sourceId, p?.positionId)
    if (!p || typeof p.sourceId !== 'string' || typeof p.positionId !== 'string' || !idPattern.test(p.sourceId) || !idPattern.test(p.positionId) || seen.has(key) || typeof p.enabled !== 'boolean' || !['source', 'list'].includes(p.placement)) throw new TypeError('Invalid resource position')
    seen.add(key)
    const anchor = p.anchor
    if (anchor !== undefined && anchor !== 'end' && (!anchor || typeof anchor.sourceId !== 'string' || typeof anchor.positionId !== 'string' || !idPattern.test(anchor.sourceId) || !idPattern.test(anchor.positionId) || !['before', 'after'].includes(anchor.side) || positionKey(anchor.sourceId, anchor.positionId) === key)) throw new TypeError('Invalid position anchor')
    return { sourceId: p.sourceId, positionId: p.positionId, enabled: p.enabled, placement: p.placement, ...(anchor !== undefined ? { anchor: anchor === 'end' ? anchor : { sourceId: anchor.sourceId, positionId: anchor.positionId, side: anchor.side } } : {}) }
  })
}
export const positionKey = (sourceId, positionId) => `${sourceId}#${positionId}`
export const POSITION_PRIORITIES = Object.freeze(['preset', 'resource', 'default'])
export function priorityOrder(preset) {
  return normalizePriority(preset.layout?.priority) ?? [...POSITION_PRIORITIES]
}
export function normalizePriority(priority) {
  if (priority === undefined) return undefined
  // Legacy user/preset choices and four-item lists migrate to an unconditional
  // manual override plus the same relative order of automatic rules.
  if (priority === 'user' || priority === 'preset') return [...POSITION_PRIORITIES]
  if (!Array.isArray(priority) || ![3, 4].includes(priority.length) || new Set(priority).size !== priority.length || priority.some(p => !['user', ...POSITION_PRIORITIES].includes(p)) || POSITION_PRIORITIES.some(p => !priority.includes(p))) throw new TypeError('Invalid position priority order')
  return priority.filter(p => p !== 'user')
}
export const positionWins = (preset, candidate, other) => candidate === 'user' || other !== 'user' && priorityOrder(preset).indexOf(candidate) < priorityOrder(preset).indexOf(other)
export const positionPriority = preset => priorityOrder(preset)
export function declaredPositions(source) {
  return source.positions ?? [{ id: 'content', name: [source.name, source.name] }]
}
export function blockPosition(descriptor, block) {
  const positions = declaredPositions(descriptor)
  return positions.find(p => p.id === block.positionId)
    ?? positions.find(p => p.match && Object.entries(p.match).every(([key, value]) => key === 'depth' ? (block.depth != null) === value : (key === 'field' ? block.source?.field ?? block.id : block[key]) === value))
    ?? positions.find(p => !p.match) ?? positions[0]
}
export function positionRows(preset, sources) {
  const sourceOrder = source => { const i = preset.rules.findIndex(r => r.kind === source.id && r.inputMode !== 'text'); return i < 0 ? preset.rules.length : i }
  const rows = [...sources].sort((a, b) => sourceOrder(a) - sourceOrder(b)).filter(s => s.supportsModule !== false && !isContextControl(s.id)).flatMap(source => {
    const rule = preset.rules.find(r => r.kind === source.id && r.inputMode !== 'text')
    return declaredPositions(source).map(position => ({ sourceId: source.id, positionId: position.id, key: positionKey(source.id, position.id), source, position, enabled: position.configurable !== false && rule?.enabled === true, placement: 'source' }))
  })
  const known = new Map(rows.map(r => [r.key, r]))
  const configured = (preset.layout?.positions ?? []).map(p => {
    const row = known.get(positionKey(p.sourceId, p.positionId))
    return row ? { ...row, ...p, enabled: row.enabled && p.enabled } : { ...p, key: positionKey(p.sourceId, p.positionId), missing: true, source: { id: p.sourceId, name: p.sourceId }, position: { id: p.positionId, name: [p.positionId, p.positionId] } }
  })
  const keys = new Set(configured.map(r => r.key))
  return [...configured, ...rows.filter(r => !keys.has(r.key))]
}
export function configurePosition(preset, sources, key, patch, beforeKey, displayOrder) {
  const rows = positionRows(preset, sources)
  if (displayOrder) rows.sort((a, b) => displayOrder.indexOf(a.key) - displayOrder.indexOf(b.key))
  const row = rows.find(r => r.key === key)
  if (!row || row.position.configurable === false) return preset
  let next = rows.map(r => r.key === key ? { ...r, ...patch } : r)
  if (beforeKey !== undefined && beforeKey !== key) {
    const target = next.find(r => r.key === key)
    next = next.filter(r => r !== target)
    const at = beforeKey === null ? next.length : next.findIndex(r => r.key === beforeKey)
    if (at < 0) return preset
    const before = rows.find(r => r.key === beforeKey)
    let cursor = before, seen = new Set()
    while (cursor?.anchor && cursor.anchor !== 'end' && !seen.has(cursor.key)) {
      seen.add(cursor.key)
      const anchorKey = positionKey(cursor.anchor.sourceId, cursor.anchor.positionId)
      if (anchorKey === key) { next = next.map(r => r.key === cursor.key ? { ...r, anchor: undefined } : r); break }
      cursor = rows.find(r => r.key === anchorKey)
    }
    next.splice(at, 0, { ...target, placement: 'list', anchor: before ? { sourceId: before.sourceId, positionId: before.positionId, side: 'before' } : 'end' })
  }
  const rules = preset.rules.map(r => r.kind === row.sourceId && r.inputMode !== 'text' && patch.enabled === true ? { ...r, enabled: true } : r)
  if (patch.enabled === true && !rules.some(r => r.kind === row.sourceId && r.inputMode !== 'text')) {
    let id = `position-source-${rules.length}`
    while (rules.some(r => r.id === id)) id += '-x'
    rules.push({ id, kind: row.sourceId, enabled: true, role: row.source.roles?.includes('preserve') ? 'preserve' : row.source.roles?.[0] ?? 'system', lifetime: row.source.lifetimes?.[0] ?? 'request', depth: null, text: '', name: '' })
  }
  const layout = preset.layout ?? { version: 1, source: 'preset-slots', priority: ['preset', 'resource', 'default'], identity: 'preserve', fallback: 'source-order', overrides: [] }
  return { ...preset, rules, layout: { ...layout, source: 'preset-slots', priority: positionPriority({ layout }), positions: next.map(({ sourceId, positionId, enabled, placement, anchor }) => ({ sourceId, positionId, enabled, placement, ...(placement === 'list' && anchor !== undefined ? { anchor } : {}) })) } }
}

/** Order whole semantic position groups. Native and retained anchors remain authoritative. */
export function applyPositionOrder(nodes, preset, diagnostics, active = null, logical = false) {
  const settings = preset.layout?.positions ?? [], priority = ['user', ...priorityOrder(preset)]
  const keyOf = n => positionKey(n.source?.module, n.positionId)
  const fixed = n => n.lifetime === 'native' || n.lifetime === 'snapshot' || n.nativeDepthAnchor
  const region = n => logical || preset.backend !== 'native' ? 'core' : n.role === 'system' ? 'system' : `${n.nativePlacement}:${n.nativeDelivery}`
  const ordered = [], visited = new Set(), visiting = new Set()
  const visit = setting => {
    if (visited.has(setting)) return
    if (visiting.has(setting)) throw Object.assign(new Error('Cyclic manual position anchors'), { code: 'POSITION_ANCHOR_CYCLE', status: 409 })
    visiting.add(setting)
    if (setting.anchor && setting.anchor !== 'end') {
      const anchor = settings.find(s => s.enabled && s.placement === 'list' && s.sourceId === setting.anchor.sourceId && s.positionId === setting.anchor.positionId)
      if (anchor) visit(anchor)
    }
    visiting.delete(setting); visited.add(setting); ordered.push(setting)
  }
  for (const setting of [...settings].reverse()) if (setting.enabled && setting.placement === 'list') visit(setting)
  for (const setting of ordered) {
    const index = settings.indexOf(setting)
    if (!setting.enabled || setting.placement !== 'list') continue
    const key = positionKey(setting.sourceId, setting.positionId)
    const all = nodes.filter(n => keyOf(n) === key)
    const winner = node => fixed(node) ? 'runtime' : priority.find(rule => rule === 'user' || rule === 'default' || rule === 'preset' && (node.slotId || node.placementSource === 'preset') || rule === 'resource' && (node.depth != null || node.nativeRequestedDepth != null || node.positionDecision === 'resource'))
    const movable = all.filter(n => active ? active.has(n) : winner(n) === 'user')
    for (const decision of new Set((active ? [] : all.filter(n => !movable.includes(n))).map(winner))) diagnostics.push({ code: 'POSITION_CONFLICT', sourceId: setting.sourceId, positionId: setting.positionId, winner: decision, requested: 'list' })
    for (const area of new Set(movable.map(region))) {
      const group = movable.filter(n => region(n) === area)
      const later = settings.slice(index + 1).map(s => positionKey(s.sourceId, s.positionId))
      const earlier = settings.slice(0, index).reverse().map(s => positionKey(s.sourceId, s.positionId))
      const rest = nodes.filter(n => !group.includes(n))
      const nextIn = (keys, predicate, last = false) => keys.map(key => last ? rest.findLast(n => keyOf(n) === key && predicate(n)) : rest.find(n => keyOf(n) === key && predicate(n))).find(Boolean)
      const explicitKey = setting.anchor && setting.anchor !== 'end' ? positionKey(setting.anchor.sourceId, setting.anchor.positionId) : null
      const explicit = explicitKey && nextIn([explicitKey], () => true, setting.anchor.side === 'after')
      if (explicitKey && !explicit) {
        diagnostics.push({ code: 'POSITION_ANCHOR_MISSING', sourceId: setting.sourceId, positionId: setting.positionId, winner: 'user', anchor: setting.anchor })
        if (preset.layout.fallback === 'error') throw Object.assign(new Error(`Manual position anchor unavailable: ${explicitKey}`), { code: 'POSITION_ANCHOR_MISSING', status: 409 })
      }
      const requestedNext = setting.anchor === 'end' ? null : explicit ?? nextIn(later, () => true)
      const requestedPrevious = nextIn(earlier, () => true, true)
      const next = nextIn(later, n => region(n) === area && (logical || preset.backend !== 'native' || !fixed(n)))
      const previous = nextIn(earlier, n => region(n) === area && (logical || preset.backend !== 'native' || !fixed(n)), true)
      // Native module anchors can bound a region but cannot be reordered themselves.
      let at = explicit && region(explicit) === area ? rest.indexOf(explicit) + (setting.anchor.side === 'after' ? 1 : 0)
        : setting.anchor === 'end' && (logical || preset.backend !== 'native') ? rest.length
        : next ? rest.indexOf(next) : logical || preset.backend !== 'native' ? rest.length : previous ? rest.indexOf(previous) + 1 : -1
      if (at < 0) at = Math.min(nodes.indexOf(group[0]), rest.length)
      if (!logical && preset.backend === 'native' && ((requestedNext && region(requestedNext) !== area) || (!requestedNext && requestedPrevious && region(requestedPrevious) !== area))) diagnostics.push({ code: 'POSITION_CONFLICT', sourceId: setting.sourceId, positionId: setting.positionId, winner: 'runtime', requested: 'list' })
      rest.splice(at, 0, ...group)
      nodes.splice(0, nodes.length, ...rest)
      for (const node of group) { node.positionDecision = 'user'; if (node.slotId) { node.originalSlotId = node.slotId; node.slotId = null; node.locked = false; node.lockReason = null } }
    }
  }
}

/** Provider-declared relative placement competes with slots and user order. */
export function applyResourceAnchors(nodes, preset, diagnostics, active = null, logical = false) {
  if (!Array.isArray(preset.layout?.priority)) return
  const priority = ['user', ...priorityOrder(preset)], groups = new Map()
  const area = n => logical || preset.backend !== 'native' ? 'core' : n.role === 'system' ? 'system' : `${n.nativePlacement}:${n.nativeDelivery}`
  for (const node of nodes) {
    if (!node.resourceAnchor || node.lifetime === 'native' || node.lifetime === 'snapshot' || node.nativeDepthAnchor) continue
    const setting = preset.layout.positions?.find(p => p.sourceId === node.source.module && p.positionId === node.positionId)
    const winner = priority.find(p => p === 'resource' || p === 'default' || p === 'preset' && node.slotId || p === 'user' && setting?.placement === 'list')
    if (active ? !active.has(node) : winner !== 'resource') continue
    const key = positionKey(node.source.module, node.positionId) + ':' + area(node)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(node)
  }
  for (const group of groups.values()) {
    const first = group[0], anchor = first.resourceAnchor
    const matches = nodes.filter(n => !group.includes(n) && n.source?.module === anchor.sourceId && (!anchor.fields || anchor.fields.includes(n.source.field)))
    const compatible = matches.filter(n => area(n) === area(first) && !n.nativeDepthAnchor && n.depth == null)
    if (!compatible.length) {
      diagnostics.push({ code: 'POSITION_ANCHOR_MISSING', sourceId: first.source.module, positionId: first.positionId, winner: matches.length ? 'runtime' : 'default', anchor })
      if (!matches.length && preset.layout.fallback === 'error') throw Object.assign(new Error(`Resource anchor unavailable: ${anchor.sourceId}`), { code: 'POSITION_ANCHOR_MISSING', status: 409 })
      continue
    }
    const target = anchor.side === 'before' ? compatible[0] : compatible.at(-1)
    const rest = nodes.filter(n => !group.includes(n)), index = rest.indexOf(target) + (anchor.side === 'after' ? 1 : 0)
    rest.splice(index, 0, ...group); nodes.splice(0, nodes.length, ...rest)
    for (const node of group) { node.positionDecision = 'resource'; if (node.slotId) { node.originalSlotId = node.slotId; node.slotId = null; node.locked = false; node.lockReason = null } }
  }
}

/** Each pass consumes only unassigned nodes; later passes cannot move consumed nodes. */
export function applyPositionStrategies(nodes, preset, diagnostics, logical = false) {
  if (!Array.isArray(preset.layout?.priority)) {
    applyPositionOrder(nodes, preset, diagnostics, null, logical)
    return []
  }
  const pending = new Set(nodes.filter(n => n.lifetime !== 'native' && n.lifetime !== 'snapshot' && !n.nativeDepthAnchor))
  const stages = []
  const setting = node => preset.layout.positions?.find(p => p.sourceId === node.source?.module && p.positionId === node.positionId)
  const manual = new Set([...pending].filter(node => node.positionOverride || setting(node)?.enabled && setting(node)?.placement === 'list'))
  for (const node of manual) { pending.delete(node); node.positionDecision = 'user' }
  for (const strategy of priorityOrder(preset)) {
    const active = new Set([...pending].filter(node => strategy === 'default'
      || strategy === 'preset' && (node.slotId || node.placementSource === 'preset')
      || strategy === 'resource' && (node.resourceAnchor || node.depth != null || node.nativeRequestedDepth != null)))
    if (strategy === 'resource') applyResourceAnchors(nodes, preset, diagnostics, active, logical)
    const consumed = [...active].filter(n => strategy !== 'resource' || n.positionDecision === 'resource' || n.depth != null || n.nativeRequestedDepth != null)
    for (const node of consumed) {
      pending.delete(node)
      node.positionDecision = strategy === 'resource' && (node.depth != null || node.nativeRequestedDepth != null) ? 'resource-depth' : strategy
    }
    stages.push({ strategy, nodeIds: consumed.map(n => n.id) })
  }
  // Apply explicit overrides after automatic anchors settle, so a custom
  // position follows its anchor when automatic rules change.
  applyPositionOrder(nodes, preset, diagnostics, manual, logical)
  stages.unshift({ strategy: 'user', nodeIds: [...manual].map(n => n.id) })
  for (const node of nodes) if (setting(node)?.placement === 'list' && node.positionDecision !== 'user') diagnostics.push({ code: 'POSITION_CONFLICT', sourceId: node.source?.module, positionId: node.positionId, winner: node.positionDecision === 'resource-depth' ? 'resource' : node.positionDecision ?? 'runtime', requested: 'list' })
  return stages
}

/** Project current resolved positions into the editor without persisting activated resources. */
export function resolvedPositionRows(preset, sources, preview) {
  const rows = positionRows(preset, sources)
  if (!preview || preview.actual) return rows
  const occurrences = new Map(), runs = []
  for (const node of preview.nodes ?? []) {
    const key = positionKey(node.source?.module, node.positionId)
    if (runs.at(-1) === key) continue
    runs.push(key)
    const list = occurrences.get(key) ?? []; list.push(runs.length - 1); occurrences.set(key, list)
  }
  for (const row of rows) {
    const positions = occurrences.get(row.key)
    row.resolved = positions?.length === 1
    row.split = positions?.length > 1
  }
  const known = rows.filter(r => r.resolved).sort((a, b) => occurrences.get(a.key)[0] - occurrences.get(b.key)[0])
  return rows.map(row => row.resolved ? known.shift() : row)
}
