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
    return { sourceId: p.sourceId, positionId: p.positionId, enabled: p.enabled, placement: p.placement }
  })
}
export const positionKey = (sourceId, positionId) => `${sourceId}#${positionId}`
export const POSITION_PRIORITIES = Object.freeze(['user', 'preset', 'resource', 'default'])
export function priorityOrder(preset) {
  const priority = preset.layout?.priority
  if (Array.isArray(priority)) return [...priority]
  return priority === 'user' || (!priority && preset.layout?.source === 'manual') ? ['user', 'preset', 'resource', 'default'] : ['preset', 'user', 'resource', 'default']
}
export function normalizePriority(priority) {
  if (priority === undefined || priority === 'user' || priority === 'preset') return priority
  if (!Array.isArray(priority) || priority.length !== POSITION_PRIORITIES.length || new Set(priority).size !== priority.length || priority.some(p => !POSITION_PRIORITIES.includes(p))) throw new TypeError('Invalid position priority order')
  return [...priority]
}
export const positionWins = (preset, candidate, other) => priorityOrder(preset).indexOf(candidate) < priorityOrder(preset).indexOf(other)
export const positionPriority = preset => preset.layout?.priority ?? (preset.layout?.source === 'manual' ? 'user' : 'preset')
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
export function configurePosition(preset, sources, key, patch, beforeKey) {
  const rows = positionRows(preset, sources), row = rows.find(r => r.key === key)
  if (!row || row.position.configurable === false) return preset
  let next = rows.map(r => r.key === key ? { ...r, ...patch } : r)
  if (beforeKey !== undefined && beforeKey !== key) {
    const target = next.find(r => r.key === key)
    next = next.filter(r => r !== target)
    const at = beforeKey === null ? next.length : next.findIndex(r => r.key === beforeKey)
    if (at < 0) return preset
    next.splice(at, 0, { ...target, placement: 'list' })
  }
  const rules = preset.rules.map(r => r.kind === row.sourceId && r.inputMode !== 'text' && patch.enabled === true ? { ...r, enabled: true } : r)
  if (patch.enabled === true && !rules.some(r => r.kind === row.sourceId && r.inputMode !== 'text')) {
    let id = `position-source-${rules.length}`
    while (rules.some(r => r.id === id)) id += '-x'
    rules.push({ id, kind: row.sourceId, enabled: true, role: row.source.roles?.includes('preserve') ? 'preserve' : row.source.roles?.[0] ?? 'system', lifetime: row.source.lifetimes?.[0] ?? 'request', depth: null, text: '', name: '' })
  }
  const layout = preset.layout ?? { version: 1, source: 'preset-slots', priority: ['user', 'preset', 'resource', 'default'], identity: 'preserve', fallback: 'source-order', overrides: [] }
  return { ...preset, rules, layout: { ...layout, source: 'preset-slots', priority: positionPriority({ layout }), positions: next.map(({ sourceId, positionId, enabled, placement }) => ({ sourceId, positionId, enabled, placement })) } }
}

/** Order whole semantic position groups. Native and retained anchors remain authoritative. */
export function applyPositionOrder(nodes, preset, diagnostics) {
  const settings = preset.layout?.positions ?? [], priority = priorityOrder(preset)
  const keyOf = n => positionKey(n.source?.module, n.positionId)
  const fixed = n => n.lifetime === 'native' || n.lifetime === 'snapshot' || n.nativeDepthAnchor
  const region = n => preset.backend !== 'native' ? 'core' : n.role === 'system' ? 'system' : `${n.nativePlacement}:${n.nativeDelivery}`
  for (let index = settings.length - 1; index >= 0; index--) {
    const setting = settings[index]
    if (!setting.enabled || setting.placement !== 'list') continue
    const key = positionKey(setting.sourceId, setting.positionId)
    const all = nodes.filter(n => keyOf(n) === key)
    const winner = node => fixed(node) ? 'runtime' : priority.find(rule => rule === 'user' || rule === 'default' || rule === 'preset' && (node.slotId || node.placementSource === 'preset') || rule === 'resource' && (node.depth != null || node.nativeRequestedDepth != null || node.positionDecision === 'resource'))
    const movable = all.filter(n => winner(n) === 'user')
    for (const decision of new Set(all.filter(n => !movable.includes(n)).map(winner))) diagnostics.push({ code: 'POSITION_CONFLICT', sourceId: setting.sourceId, positionId: setting.positionId, winner: decision, requested: 'list' })
    for (const area of new Set(movable.map(region))) {
      const group = movable.filter(n => region(n) === area)
      const later = settings.slice(index + 1).map(s => positionKey(s.sourceId, s.positionId))
      const earlier = settings.slice(0, index).reverse().map(s => positionKey(s.sourceId, s.positionId))
      const rest = nodes.filter(n => !group.includes(n))
      const nextIn = (keys, predicate, last = false) => keys.map(key => last ? rest.findLast(n => keyOf(n) === key && predicate(n)) : rest.find(n => keyOf(n) === key && predicate(n))).find(Boolean)
      const requestedNext = nextIn(later, () => true)
      const requestedPrevious = nextIn(earlier, () => true, true)
      const next = nextIn(later, n => region(n) === area && (preset.backend !== 'native' || !fixed(n)))
      const previous = nextIn(earlier, n => region(n) === area && (preset.backend !== 'native' || !fixed(n)), true)
      // Native module anchors can bound a region but cannot be reordered themselves.
      let at = next ? rest.indexOf(next) : previous ? rest.indexOf(previous) + 1 : -1
      if (at < 0) at = Math.min(nodes.indexOf(group[0]), rest.length)
      if (preset.backend === 'native' && ((requestedNext && region(requestedNext) !== area) || (!requestedNext && requestedPrevious && region(requestedPrevious) !== area))) diagnostics.push({ code: 'POSITION_CONFLICT', sourceId: setting.sourceId, positionId: setting.positionId, winner: 'runtime', requested: 'list' })
      rest.splice(at, 0, ...group)
      nodes.splice(0, nodes.length, ...rest)
      for (const node of group) { node.positionDecision = 'user'; if (node.slotId) { node.originalSlotId = node.slotId; node.slotId = null; node.locked = false; node.lockReason = null } }
    }
  }
}

/** Provider-declared relative placement competes with slots and user order. */
export function applyResourceAnchors(nodes, preset, diagnostics) {
  if (!Array.isArray(preset.layout?.priority)) return
  const priority = priorityOrder(preset), groups = new Map()
  const area = n => preset.backend !== 'native' ? 'core' : n.role === 'system' ? 'system' : `${n.nativePlacement}:${n.nativeDelivery}`
  for (const node of nodes) {
    if (!node.resourceAnchor || node.lifetime === 'native' || node.lifetime === 'snapshot' || node.nativeDepthAnchor) continue
    const setting = preset.layout.positions?.find(p => p.sourceId === node.source.module && p.positionId === node.positionId)
    const winner = priority.find(p => p === 'resource' || p === 'default' || p === 'preset' && node.slotId || p === 'user' && setting?.placement === 'list')
    if (winner !== 'resource') continue
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
