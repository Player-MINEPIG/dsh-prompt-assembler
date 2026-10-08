import { normalizePositions, normalizePriority } from './resource-positions.js'
/** Resource layouts are evaluated each request; persisted policy never contains activated entry lists. */
const fail = (message, code = 'ASSEMBLY_LAYOUT_UNSUPPORTED') => { throw Object.assign(new Error(message), { code, status: 409 }) }
export function normalizeLayout(value) {
  if (value === undefined) return undefined
  if (!value || value.version !== 1 || !['manual', 'preset-slots'].includes(value.source) || !['preserve', 'position'].includes(value.identity) || !['source-order', 'error'].includes(value.fallback) || !Array.isArray(value.overrides) || value.overrides.length > 128) throw new TypeError('Invalid resource layout policy')
  const seen = new Set()
  const overrides = value.overrides.map(o => {
    if (!o || ![o.target, o.anchor].every(s => typeof s === 'string' && s.length > 0 && s.length <= 4096) || o.target === o.anchor || seen.has(o.target) || !['before', 'after'].includes(o.side) || typeof o.detach !== 'boolean') throw new TypeError('Invalid layout override')
    seen.add(o.target); return { target: o.target, anchor: o.anchor, side: o.side, detach: o.detach }
  })
  const priority = normalizePriority(value.priority)
  const positions = normalizePositions(value.positions)
  return { version: 1, source: value.source, identity: value.identity, fallback: value.fallback, overrides, ...(priority ? { priority } : {}), ...(positions ? { positions } : {}) }
}
export function layoutPlacement(preset) {
  if (!preset.layout) return preset.placement
  return preset.backend === 'native' ? preset.layout.source === 'preset-slots' ? 'native-slots' : 'native-roles' : preset.layout.source === 'preset-slots' ? 'st' : 'modules'
}
const region = (n, preset) => preset.backend !== 'native' ? 'request' : n.source?.module === 'history' ? 'history' : n.source?.module === 'input' ? 'input' : n.role === 'system' || n.source?.module === 'native-system' ? 'system' : `${n.nativePlacement ?? 'after-input'}:${n.nativeDelivery ?? preset.rules.find(r => r.id === n.ruleId)?.delivery ?? 'context'}`
function groupKey(n, preset) {
  // Worldbook groups use position and identity, never the current activated entries.
  return n.layoutKey ?? JSON.stringify([n.ruleId, n.source?.module, n.source?.resourceId ?? null, n.layoutGroup ?? n.source?.field ?? n.id, n.slotId ?? null, n.depth ?? n.nativeRequestedDepth ?? null, n.role, region(n, preset)])
}
export function resourceBlocks(nodes, preset) {
  const blocks = [], occurrences = new Map()
  for (const node of nodes) {
    const key = groupKey(node, preset), last = blocks.at(-1)
    if (last?.key === key && (!node.layoutBlockId || last.id === node.layoutBlockId)) { last.nodes.push(node); continue }
    const occurrence = occurrences.get(key) ?? 0; occurrences.set(key, occurrence + 1)
    blocks.push({ id: node.layoutBlockId ?? `block:${key}:${occurrence}`, key, nodes: [node], region: region(node, preset) })
  }
  return blocks.map(({ key, ...b }) => {
    const first = b.nodes[0]
    if (!first.layoutBlockId && occurrences.get(key) > 1) b.id = `block:${key}:run:${first.id}`
    const fixed = b.nodes.some(n => n.lifetime === 'native' || n.lifetime === 'snapshot' || n.nativeDepthAnchor || n.depth != null)
    const slotId = first.slotId ?? null
    return { ...b, name: first.layoutGroup ? `${first.source.module} · ${first.layoutGroup}` : first.name, slotId,
      binding: slotId ? 'slot' : fixed ? 'runtime' : 'free', movable: !fixed && !slotId, overridable: !fixed && !!slotId,
      originalRoles: [...new Set(b.nodes.map(n => n.originalRole ?? n.authoredRole ?? n.role))], effectiveRoles: [...new Set(b.nodes.flatMap(n => n.messageRoles?.length ? n.messageRoles : [n.role]))],
      reason: first.positionOverride ? 'user-override' : first.lockReason ?? (preset.layout?.source === 'manual' ? 'manual-source-order' : 'source-order'),
      internalOrder: 'source-defined', retention: [...new Set(b.nodes.map(n => n.lifetime))],
      limitations: b.region.endsWith(':context') ? ['NATIVE_CONTEXT_REUSES_HISTORY_POSITION'] : fixed ? ['RUNTIME_POSITION_FIXED'] : [] }
  })
}
function validNativeOrder(blocks) {
  const phases = { system: 0, history: 1, 'before-input:pre-step': 2, input: 3, 'after-input:context': 4, 'after-input:pre-step': 5 }
  return blocks.every((b, i) => i === 0 || (phases[blocks[i - 1].region] ?? 5) <= (phases[b.region] ?? 5))
}
export function applyLayoutOverrides(nodes, preset, diagnostics) {
  if (!preset.layout) return
  if (preset.layout.fallback === 'error' && diagnostics.some(d => ['WORLD_BOOK_SLOT_MISSING', 'NATIVE_SLOTS_ABSENT', 'ASSEMBLY_REFERENCE_UNAVAILABLE'].includes(d.code))) fail('A requested resource or preset slot is unavailable', 'LAYOUT_TARGET_MISSING')
  const blocks = resourceBlocks(nodes, preset)
  for (const block of blocks) for (const node of block.nodes) { node.layoutKey = groupKey(node, preset); node.layoutBlockId = block.id }
  for (const override of preset.layout.overrides) {
    const block = blocks.find(b => b.id === override.target), anchor = blocks.find(b => b.id === override.anchor)
    if (!block || !anchor) {
      diagnostics.push({ code: 'LAYOUT_TARGET_MISSING', ...override, missing: !block ? 'target' : 'anchor' })
      if (preset.layout.fallback === 'error') fail('Resource layout target is no longer available', 'LAYOUT_TARGET_MISSING')
      continue
    }
    if (!block.movable && !(block.overridable && override.detach)) fail('Slot-bound blocks require an explicit custom-position override; runtime anchors cannot move')
    const next = blocks.filter(b => b !== block); next.splice(next.indexOf(anchor) + (override.side === 'after' ? 1 : 0), 0, block)
    if (preset.backend === 'native' && block.region.endsWith(':pre-step')) {
      block.region = next.indexOf(block) < next.findIndex(b => b.region === 'input') ? 'before-input:pre-step' : 'after-input:pre-step'
    }
    if (preset.backend === 'native' && !validNativeOrder(next)) fail('This move crosses a native role or delivery boundary')
    for (const node of block.nodes) { node.positionOverride = structuredClone(override); if (preset.backend === 'native' && block.region.endsWith(':pre-step')) node.nativePlacement = block.region.split(':')[0]; if (override.detach) { node.originalSlotId = node.slotId; node.slotId = null; node.locked = false; node.lockReason = null } }
    blocks.splice(0, blocks.length, ...next)
  }
  nodes.splice(0, nodes.length, ...blocks.flatMap(b => b.nodes))
}
export function describeResourceLayout(nodes, preset, slots = []) {
  return { version: 1, legacy: !preset.layout, policy: preset.layout ?? null, slots, blocks: resourceBlocks(nodes, preset).map(({ nodes: members, ...b }) => ({ ...b, nodeIds: members.map(n => n.id), entries: members.map(n => ({ id: n.id, source: n.source, text: n.text, originalRole: n.originalRole ?? n.authoredRole ?? n.role, effectiveRole: n.role, positionId: n.positionId, positionDecision: n.positionDecision, originalSlotId: n.originalSlotId ?? n.slotId ?? null, order: n.order ?? null, lifetime: n.lifetime, children: n.children ?? [], positionOverride: n.positionOverride ?? null })) })) }
}
export function withBlockMove(preset, layout, target, anchor, side = 'before', detach = false) {
  if (!preset.layout || layout.legacy) fail('Explicitly adopt a resource layout policy before moving blocks')
  const b = layout.blocks.find(b => b.id === target)
  if (!b || !layout.blocks.some(b => b.id === anchor)) fail('Refresh current resources before moving this block')
  if (!b.movable && !(detach && b.overridable)) fail('This block follows a slot or a runtime anchor')
  detach ||= preset.layout.overrides.find(o => o.target === target)?.detach === true
  return { ...preset, layout: normalizeLayout({ ...preset.layout, overrides: [...preset.layout.overrides.filter(o => o.target !== target), { target, anchor, side, detach }] }) }
}
