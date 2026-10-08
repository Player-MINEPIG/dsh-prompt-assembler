import { blockPosition, declaredPositions, positionKey, positionWins, priorityOrder, applyPositionOrder, applyResourceAnchors } from './resource-positions.js'
import { applyLayoutOverrides, describeResourceLayout } from './resource-layout.js'
import { createHash, randomUUID } from 'node:crypto'
import { adaptiveNativePlacement } from './native-policy.js'
import { projectNativeOrder } from './native-order.js'
import { normalizePreset } from './model.js'

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const textOf = message => (message.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n')
import { createDshRegistry as createDefaultRegistry } from '../adapters/dsh.js'
function message(role, text, id) {
  const hex = hash(id)
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
  return { id: uuid, role, content: [{ type: 'text', text }], source: role === 'assistant' ? { kind: 'model', provider: 'tavern', model: 'assembly' } : { kind: role === 'system' ? 'system-prompt' : 'tavern-assembly' } }
}
/** Preserve native order and complete tool transactions when inserting depth prompts. */
export function insertionIndex(messages, depth) {
  let index = Math.max(0, messages.length - depth)
  const pending = new Set()
  for (let i = 0; i < index; i++) {
    const m = messages[i]
    for (const b of m.content ?? []) if (b.type === 'tool-call') pending.add(b.id)
    if (m.role === 'tool') pending.delete(m.toolCallId ?? m.source?.callId ?? m.callId)
  }
  while (pending.size && index < messages.length) {
    const m = messages[index++]
    for (const b of m.content ?? []) if (b.type === 'tool-call') pending.add(b.id)
    if (m.role === 'tool') pending.delete(m.toolCallId ?? m.source?.callId ?? m.callId)
  }
  if (pending.size) throw new Error('Cannot insert into an unfinished native tool transaction')
  return index
}

function requestContext(options) {
  const { preset, assets = {}, nativeMessages = [], inputIds = [], preview = false, signal, sessionId = '', turn = null, step = null } = options
  // Legacy loader context also carries live Agent/scope services. Only macro data crosses the source API.
  const macroData = Object.fromEntries(Object.entries(assets.context ?? {}).filter(([, value]) => typeof value === 'string'))
  return { preset: normalizePreset(preset), assets: { ...assets, context: macroData }, nativeMessages, inputIds, preview, signal, sessionId, turn, step }
}
/** Synchronous helper for synchronous sources; the Host uses the async counterpart. */
export function assembleRequest(options) {
  const registry = options.registry ?? createDefaultRegistry(), context = requestContext(options)
  const resolution = registry.resolveSync(context)
  return assembleResolved(options, resolution.context, resolution)
}
export async function assembleRequestAsync(options) {
  const registry = options.registry ?? createDefaultRegistry(), context = requestContext(options)
  const resolution = await registry.resolve(context)
  return assembleResolved(options, resolution.context, resolution)
}
function assembleResolved({ preset: suppliedPreset, previous = null, snapshots = [], maxBytes = 2 * 1024 * 1024, afterAssembly }, request, resolution) {
  const { preset, assets, nativeMessages, inputIds, preview } = request
  const adaptive = adaptiveNativePlacement(preset)
  if (!adaptive && ['native-roles', 'native-slots'].includes(preset.placement)) throw new TypeError('Native placement requires the native backend')
  const rules = preset.rules.filter(r => r.enabled), entries = resolution.resolved
  const listed = new Set(preset.rules.map(rule => rule.id)), listPlacement = preset.placement === 'modules' || preset.layout?.source === 'manual'
  const byRule = new Map(entries.map(e => [e.rule.id, e])), bySource = new Map(entries.map(e => [e.descriptor.id, e]))
  // Authored text uses a source parser without replacing that source's own
  // content module as the target of other sources' declared references.
  for (const entry of entries.filter(e => e.rule.inputMode !== 'text')) bySource.set(entry.descriptor.id, entry)
  const enabled = kind => rules.some(r => r.kind === kind)
  const positionSettings = new Map((preset.layout?.positions ?? []).map(p => [positionKey(p.sourceId, p.positionId), p]))
  const positionOf = (entry, block) => blockPosition(entry.descriptor, block)
  const settingOf = (entry, block) => positionSettings.get(positionKey(entry.descriptor.id, positionOf(entry, block)?.id))
  const positionEnabled = (entry, block) => block.type === 'reference' || settingOf(entry, block)?.enabled !== false || (preset.backend === 'native' && ['history', 'input'].includes(entry.descriptor.id))
  const userPlaced = (entry, block) => block.type !== 'reference' && settingOf(entry, block)?.placement === 'list' && positionWins(preset, 'user', 'preset') && positionWins(preset, 'user', 'default') && (block.depth == null && !positionOf(entry, block)?.anchor || positionWins(preset, 'user', 'resource')) && !['native-system', 'history', 'input'].includes(entry.descriptor.id)
  const preferSource = (entry, block) => block.type !== 'native' && listed.has(entry.rule.id) && (positionWins(preset, 'default', 'preset') || Array.isArray(preset.layout?.priority) && (block.depth != null || positionOf(entry, block)?.anchor) && positionWins(preset, 'resource', 'preset'))
  const positionEvents = []
  for (const entry of entries) for (const block of entry.blocks) if (!positionEnabled(entry, block)) positionEvents.push({ sourceId: entry.descriptor.id, positionId: positionOf(entry, block)?.id, decision: 'disabled' })
  const slots = []
  const diagnostics = structuredClone(assets.diagnostics ?? []).filter(d => !((preset.placement === 'st' || adaptive) && d.code === 'WORLD_BOOK_POSITION_APPROXIMATED' && d.originalPosition === 'at_depth'))
  for (const setting of preset.layout?.positions ?? []) {
    const descriptor = resolution.catalog?.find(s => s.id === setting.sourceId)
    if (descriptor && declaredPositions(descriptor).some(p => p.id === setting.positionId)) continue
    diagnostics.push({ code: 'POSITION_SOURCE_MISSING', sourceId: setting.sourceId, positionId: setting.positionId })
    if (setting.enabled && preset.layout.fallback === 'error') throw Object.assign(new Error(`Resource position unavailable: ${setting.sourceId}/${setting.positionId}`), { code: 'POSITION_SOURCE_MISSING', status: 409 })
  }
  diagnostics.push(...resolution.diagnostics, ...entries.flatMap(e => e.diagnostics ?? []))
  if (adaptive) for (let i = diagnostics.length - 1; i >= 0; i--) {
    const d = diagnostics[i]
    if (d.code === 'WORLD_BOOK_POSITION_APPROXIMATED' && entries.some(e => e.descriptor.id === 'worldbook' && e.blocks.some(b => b.group === d.originalPosition && b.source?.resourceId === d.resourceId && b.source?.field === String(d.entryId)))) diagnostics.splice(i, 1)
  }
  const variables = new Map(), macros = new Map(), claims = new Map(), nodes = [], deferred = [], nativeById = new Map(nativeMessages.map(m => [m.id, m])), requiredNative = new Set()
  const key = (entry, block) => `${entry.rule.id}:${block.id}`
  const origin = (entry, block) => ({ plugin: entry.descriptor.pluginId, module: entry.descriptor.id, sourceId: entry.descriptor.id, version: entry.descriptor.version, resourceId: block.source?.resourceId ?? null, field: block.source?.field ?? block.id,
    generationRequiresPlugin: entry.descriptor.generationRequiresPlugin, recordedContentSurvivesRemoval: true })
  for (const entry of entries) for (const [name, blockId] of Object.entries(entry.macros ?? {})) {
    const block = entry.blocks.find(b => b.id === blockId && b.type === 'text')
    if (!block || macros.has(name)) throw new TypeError(`Invalid or duplicate source macro: ${name}`)
    macros.set(name, { entry, block })
  }
  const macroAllowed = target => positionEnabled(target.entry, target.block) && !userPlaced(target.entry, target.block) && !preferSource(target.entry, target.block) && !(listPlacement && listed.has(target.entry.rule.id) && !target.block.referenceOnly)
  const roots = rules.flatMap(rule => (byRule.get(rule.id)?.blocks ?? []).filter(b => (!b.referenceOnly || userPlaced(byRule.get(rule.id), b) || preferSource(byRule.get(rule.id), b)) && positionEnabled(byRule.get(rule.id), b)).map(block => ({ entry: byRule.get(rule.id), block })))
  // Claims are determined before list placement. A reference has the same effect
  // whether its fallback source is before or after it in the user's strategy.
  function claimContent(entry, block) {
    const owner = key(entry, block)
    for (const claim of block.claims ?? []) {
      const target = bySource.get(claim.sourceId), item = target?.blocks.find(b => b.id === claim.blockId)
      if (item && positionEnabled(target, item) && !userPlaced(target, item) && !preferSource(target, item) && !claims.has(key(target, item))) claims.set(key(target, item), owner)
    }
    if (block.type === 'text') for (const match of block.text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
      const target = macros.get(match[1]); if (target && macroAllowed(target) && !claims.has(key(target.entry, target.block))) claims.set(key(target.entry, target.block), owner)
    }
  }
  const missingReferences = new Set()
  function targets(block) {
    const entry = bySource.get(block.sourceId)
    if (!entry) { if (!missingReferences.has(block.sourceId)) { missingReferences.add(block.sourceId); diagnostics.push({ code: 'ASSEMBLY_REFERENCE_UNAVAILABLE', sourceId: block.sourceId }) }; return [] }
    // A source shown in the list owns its position in list mode. References
    // cannot relocate it or bypass its disabled list rule. Unlisted dependency
    // sources still belong to the source's authored reference position.
    if (listPlacement && listed.has(entry.rule.id) && (preset.layout?.source === 'manual' || !block.useOwnerRule)) return entry.blocks.filter(b => b.referenceOnly && block.blockIds?.includes(b.id)).map(block => ({ entry, block }))
    if (block.honorEnabled !== false && listed.has(entry.rule.id) && !enabled(block.sourceId)) return []
    return entry.blocks.filter(b => positionEnabled(entry, b) && !userPlaced(entry, b) && !preferSource(entry, b) && (!block.blockIds || block.blockIds.includes(b.id)) && (!block.group || b.group === block.group) && (block.blockIds || !b.referenceOnly)).map(b => ({ entry, block: b }))
  }
  function claimReferences(entry, block, path = new Set()) {
    if (block.type !== 'reference') return
    const owner = key(entry, block)
    if (path.has(owner)) throw new TypeError('Cyclic source block reference')
    const next = new Set([...path, owner])
    for (const target of targets(block)) {
      const id = key(target.entry, target.block)
      if (!claims.has(id)) { claims.set(id, owner); claimReferences(target.entry, target.block, next) }
      else if (next.has(id)) throw new TypeError('Cyclic source block reference')
    }
  }
  // Preset slots own their references even if another module is dragged ahead
  // of the preset. Keep legacy claim precedence in other placement modes.
  const claimGroups = adaptive
    ? [roots.filter(r => r.entry.descriptor.id === 'preset'), roots.filter(r => r.entry.descriptor.id !== 'preset')]
    : [roots]
  for (const group of claimGroups) {
    for (const { entry, block } of group) claimContent(entry, block)
    for (const { entry, block } of group) claimReferences(entry, block)
  }
  const presetKeys = new Set(roots.filter(r => r.entry.descriptor.id === 'preset').map(r => key(r.entry, r.block)))
  const isPresetOwned = identity => {
    const seen = new Set()
    while (claims.has(identity) && !seen.has(identity)) { seen.add(identity); identity = claims.get(identity) }
    return presetKeys.has(identity)
  }
  const placementControls = adaptive ? preset.rules.map(rule => {
    const entry = byRule.get(rule.id)
    const blocks = (entry?.blocks ?? []).filter(b => b.type === 'text' && b.text.trim())
    const owned = blocks.filter(b => isPresetOwned(key(entry, b))).length
    const independent = blocks.filter(b => !claims.has(key(entry, b)) && !b.referenceOnly).length
    const control = rule.kind === 'preset' ? 'preset' : ['history', 'input'].includes(rule.kind) ? 'native'
      : owned ? independent ? 'mixed' : 'preset' : independent || rule.kind === 'native-system' ? 'independent' : 'empty'
    return { ruleId: rule.id, control, owned, independent }
  }) : undefined
  const emitted = new Set(), plans = new Map(rules.map(r => [r.id, []]))
  function emit(entry, block, effectiveRule = entry.rule, reference = null, path = new Set()) {
    const identity = key(entry, block), owner = reference?.owner
    if (!positionEnabled(entry, block)) return
    if ((claims.has(identity) && claims.get(identity) !== owner) || emitted.has(identity)) return
    if (path.has(identity)) throw new TypeError('Cyclic source block reference')
    const next = new Set([...path, identity])
    emitted.add(identity)
    if (block.type === 'reference') {
      const referenced = targets(block)
      slots.push({ id: identity, source: origin(entry, block), targetSourceId: block.sourceId, group: block.group ?? null, emitsText: false, nodeIds: referenced.map(t => key(t.entry, t.block)), duplicate: referenced.length > 0 && referenced.every(t => emitted.has(key(t.entry, t.block))) })
      if (slots.at(-1).duplicate) diagnostics.push({ code: 'LAYOUT_DUPLICATE_SLOT', slotId: identity })
      for (const target of referenced) {
        const targetRule = block.useOwnerRule ? effectiveRule : target.entry.rule
        emit(target.entry, target.block, targetRule, { slotId: reference?.slotId ?? identity, owner: identity, placementRule: reference?.placementRule ?? effectiveRule.id, locked: block.lock !== false, reason: `reference:${block.owner ?? block.id}`, sourceId: reference?.sourceId ?? entry.descriptor.id, authoredRole: reference?.authoredRole ?? (entry.descriptor.id === 'preset' ? block.role ?? 'system' : undefined) }, next)
      }
      return
    }
    const targetRule = block.targetSourceId ? rules.find(r => r.kind === block.targetSourceId) ?? effectiveRule : effectiveRule
    let messages, rendered, children = structuredClone(block.children ?? []), role, lifetime, contentHash
    if (block.type === 'native') {
      messages = block.messageIds.map(id => { const msg = nativeById.get(id); if (!msg) throw new TypeError(`Unknown native message: ${id}`); requiredNative.add(id); return msg })
      if (!messages.length && !(adaptive && ['history', 'input'].includes(entry.descriptor.id))) return
      rendered = messages.map(textOf).join('\n\n'); role = 'preserve'; lifetime = 'native'; contentHash = hash(messages)
    } else {
      const expanded = block.text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (whole, name) => {
        const target = macros.get(name)
        if (!target) return whole
        if (target.entry.descriptor.id !== entry.descriptor.id && !entry.descriptor.dependencies.includes(target.entry.descriptor.id)) throw new TypeError(`Undeclared macro dependency from ${entry.descriptor.id}`)
        if (!macroAllowed(target)) return ''
        children.push({ positionId: positionOf(target.entry, target.block)?.id, positionDecision: 'preset', id: `${identity}:${name}:${children.length}`, name: target.block.id, locked: true, lockReason: `macro:${name}`, source: origin(target.entry, target.block), text: target.block.text, stability: target.entry.descriptor.stability, lifetime: 'request' })
        return target.block.text
      })
      rendered = entry.renderText({ text: expanded, context: request, variables, block, diagnostics, identity })
      if (typeof rendered !== 'string') throw new TypeError('renderText must synchronously return text')
      if (!rendered) return
      role = preset.layout?.identity === 'preserve' ? block.role ?? (targetRule.inputMode === 'text' && targetRule.role !== 'preserve' ? targetRule.role : 'system') : preset.placement === 'native-roles' && entry.descriptor.id === 'worldbook' ? block.role ?? 'system'
        : adaptive && (entry.descriptor.id === 'preset' || reference?.authoredRole)
        ? reference?.authoredRole ?? block.role ?? 'system'
        : targetRule.role === 'preserve' ? block.role ?? 'system' : targetRule.role
      lifetime = targetRule.lifetime; contentHash = hash({ text: rendered, role })
      messages = [message(role, rendered, `tavern-${hash({ id: identity, contentHash }).slice(0, 32)}`)]
    }
    const placementRule = block.targetSourceId ? targetRule : entry.rule
    const controlled = listPlacement && listed.has(placementRule.id)
    // Native block depth can anchor immutable system updates within native
    // history. Moving a module must not rewrite that internal message order.
    let depth = controlled && block.type !== 'native' ? placementRule.depth
      : block.depth ?? (listed.has(entry.rule.id) ? targetRule.depth : entry.rule.depth)
    if (block.type !== 'native') {
      const userDepth = settingOf(entry, block)?.placement === 'list' && positionWins(preset, 'user', 'resource') && positionWins(preset, 'user', 'default') && (!reference?.slotId || positionWins(preset, 'user', 'preset'))
      const presetDepth = Array.isArray(preset.layout?.priority) && reference?.slotId && positionWins(preset, 'preset', 'resource')
      if (depth != null && (userDepth || presetDepth || positionWins(preset, 'default', 'resource'))) depth = null
    }
    const nativeRequestedDepth = adaptive && depth != null ? depth : null
    if (nativeRequestedDepth !== null) {
      if (!(preset.placement === 'native-slots' && entry.descriptor.id === 'worldbook' && [0, 1].includes(nativeRequestedDepth))) diagnostics.push({ code: 'NATIVE_DEPTH_APPROXIMATED', id: identity, name: block.name || block.id, depth })
      depth = null
    }
    const node = { ...(positionOf(entry, block)?.anchor ? { resourceAnchor: positionOf(entry, block).anchor } : {}), positionId: positionOf(entry, block)?.id, positionDecision: block.type === 'native' ? 'runtime' : userPlaced(entry, block) ? 'user' : depth != null || nativeRequestedDepth != null ? 'resource-depth' : reference?.slotId ? 'preset' : 'source', originalRole: block.type === 'native' ? 'preserve' : block.role ?? (targetRule.inputMode === 'text' && targetRule.role !== 'preserve' ? targetRule.role : 'system'), messageRoles: messages.map(m => m.role), layoutGroup: block.group ?? null, slotId: reference?.slotId ?? null, id: identity, ruleId: targetRule.id, module: targetRule.kind, name: block.name || block.id, role, text: rendered, messages, source: origin(entry, block),
      ...(adaptive ? { placementSource: reference?.sourceId ?? null, nativeRequestedDepth } : {}),
      stability: block.stability ?? entry.descriptor.stability,
      lifetime, recorded: true, locked: reference?.locked ?? false, lockReason: reference?.locked ? reference.reason : null, children, hash: contentHash, depth, order: block.order ?? 100, changed: previous?.nodes?.find(n => n.id === identity)?.hash !== contentHash }
    if (depth != null) deferred.push(node)
    else (plans.get(block.targetSourceId ? targetRule.id : reference?.placementRule ?? targetRule.id) ?? []).push(node)
  }
  // Evaluate in list order; explicit claims already exclude fallback duplicates.
  for (const { entry, block } of roots) emit(entry, block)
  for (const rule of rules) nodes.push(...plans.get(rule.id))
  if (adaptive) {
    projectNativeOrder(nodes, preset, diagnostics)
    for (const control of placementControls) {
      if (['preset', 'history', 'input'].includes(preset.rules.find(r => r.id === control.ruleId)?.kind)) continue
      const fixed = nodes.filter(n => n.ruleId === control.ruleId && n.nativeDepthAnchor)
      control.owned += fixed.length
      control.independent = nodes.filter(n => n.ruleId === control.ruleId && n.source.module !== 'preset' && n.placementSource !== 'preset' && !n.nativeDepthAnchor).length
      control.control = control.owned ? control.independent ? 'mixed' : 'preset' : control.independent ? 'independent' : 'empty'
    }
    for (const node of nodes) if (node.lifetime !== 'native') { node.hash = hash({ text: node.text, role: node.role }); node.changed = previous?.nodes?.find(n => n.id === node.id)?.hash !== node.hash }
  }
  // Resolve placement before lifetime so depth rules and list rules share retention.
  // Preserve authored order within each depth, independent of the preset list.
  const depthGroups = new Map()
  for (const node of deferred) { if (!depthGroups.has(node.depth)) depthGroups.set(node.depth, []); depthGroups.get(node.depth).push(node) }
  for (const group of depthGroups.values()) group.sort((a, b) => a.order - b.order)
  for (const node of [...depthGroups.values()].flat()) {
    const flat = nodes.flatMap(n => n.messages)
    const nativePositions = flat.flatMap((m, i) => nativeMessages.some(n => n.id === m.id) && m.role !== 'system' ? [i] : [])
    const requested = node.depth === 0 ? flat.length : nativePositions[Math.max(0, nativePositions.length - node.depth)] ?? flat.length
    const index = insertionIndex(flat, flat.length - requested)
    Object.assign(node, { locked: true, lockReason: 'depth', adjustedForTools: index !== requested })
    let offset = 0, inserted = false
    for (let i = 0; i < nodes.length; i++) {
      const current = nodes[i], count = current.messages.length
      if (index >= offset && index <= offset + count) {
        const within = index - offset
        const parts = []
        if (within > 0) parts.push({ ...current, messages: current.messages.slice(0, within), text: current.messages.slice(0, within).map(textOf).join('\n\n') })
        parts.push(node)
        if (within < count) parts.push({ ...current, id: `${current.id}:split:${within}`, messages: current.messages.slice(within), text: current.messages.slice(within).map(textOf).join('\n\n') })
        nodes.splice(i, 1, ...parts); inserted = true; break
      }
      offset += count
    }
    if (!inserted) nodes.push(node)
  }
  applyLayoutOverrides(nodes, preset, diagnostics)
  applyResourceAnchors(nodes, preset, diagnostics)
  applyPositionOrder(nodes, preset, diagnostics)
  // Native markers are nested in the preset output, not dropped from the request.
  let messages = [], expanded = []
  const snapshotRules = rules.filter(r => r.lifetime === 'snapshot' && byRule.has(r.id))
  const nextSnapshots = snapshots.filter(s => snapshotRules.some(r => r.id === s.ruleId))
  const handledSnapshots = new Set()
  for (const node of nodes) {
    if (node.lifetime === 'snapshot') {
      const rule = snapshotRules.find(r => r.id === node.ruleId)
      handledSnapshots.add(node.id)
      const payload = node.messages, contentHash = node.hash
      const last = nextSnapshots.findLast(s => s.id === node.id)
      if (last?.hash !== contentHash) nextSnapshots.push({ id: node.id, ruleId: rule.id, name: node.name, source: node.source, depth: node.depth, hash: contentHash, messages: payload.map(m => ({ ...m, id: randomUUID() })), afterId: messages.at(-1)?.id ?? null, nativeAfterId: messages.findLast(m => nativeMessages.some(n => n.id === m.id))?.id ?? null, module: node.module })
      continue
    }
    expanded.push({ ...node, start: messages.length, count: node.messages.length }); messages.push(...node.messages)
  }
  for (const id of new Set(nextSnapshots.map(s => s.id))) {
    if (handledSnapshots.has(id)) continue
    const last = nextSnapshots.findLast(s => s.id === id)
    if (last.hash !== 'empty') nextSnapshots.push({ ...last, hash: 'empty', messages: [message('system', `Current context is empty for entry ${last.name}. Its earlier snapshots are no longer current.`, `tavern-${randomUUID()}`)], afterId: nativeMessages.at(-1)?.id ?? null })
  }
  // Retained snapshots keep their original native-history anchor, before later replies.
  const anchors = new Map()
  for (const snapshot of nextSnapshots) {
    let anchor = snapshot.afterId
    let original = anchor === null ? -1 : messages.findIndex(m => m.id === anchor)
    if (original === -1 && anchor !== null) {
      anchor = snapshot.nativeAfterId ?? null
      original = anchor === null ? -1 : messages.findIndex(m => m.id === anchor)
      if (original === -1 && anchor !== null) { diagnostics.push({ code: 'SNAPSHOT_ANCHOR_NO_LONGER_ACTIVE', id: snapshot.id }); continue }
      diagnostics.push({ code: 'SNAPSHOT_ANCHORED_TO_NATIVE_HISTORY', id: snapshot.id })
    }
    const offset = anchors.get(anchor) ?? 0
    messages.splice(original + 1 + offset, 0, ...snapshot.messages)
    anchors.set(anchor, offset + snapshot.messages.length)
    expanded.push({ id: `${snapshot.id}:retained:${snapshot.messages[0].id}`, ruleId: snapshot.ruleId, module: snapshot.module, name: snapshot.name, source: snapshot.source,
      messages: snapshot.messages, text: snapshot.messages.map(textOf).join('\n\n'), role: snapshot.messages[0]?.role, stability: 'snapshot', lifetime: 'snapshot', recorded: true,
      locked: true, lockReason: 'retained-snapshot', depth: snapshot.depth ?? null, hash: snapshot.hash, children: [] })
  }
  const seenNative = messages.filter(m => nativeMessages.some(n => n.id === m.id)).map(m => m.id)
  const required = [...requiredNative]
  if (required.length !== seenNative.length || new Set(seenNative).size !== required.length) throw new Error('Assembly must include each enabled native message exactly once')
  const nativeSystemIds = nativeMessages.filter(m => m.role === 'system' && requiredNative.has(m.id)).map(m => m.id)
  if (nativeSystemIds.length) {
    const expected = nativeMessages.filter(m => requiredNative.has(m.id)).map(m => m.id)
    // A layout may move complete native modules, but cannot reverse the
    // history boundaries of an effective native system update.
    for (const systemId of nativeSystemIds) {
      const before = new Set(expected.slice(0, expected.indexOf(systemId)).filter(id => !nativeSystemIds.includes(id)))
      const actual = new Set(seenNative.slice(0, seenNative.indexOf(systemId)).filter(id => !nativeSystemIds.includes(id)))
      if (before.size !== actual.size || [...before].some(id => !actual.has(id))) throw Object.assign(new Error('This layout moves native messages across a system update boundary'), { code: 'ASSEMBLY_NATIVE_SYSTEM_ORDER', status: 409 })
    }
  }
  const openCalls = new Set()
  for (const msg of messages) {
    if (openCalls.size && msg.role !== 'tool') throw new Error('Assembly cannot split a tool call and its results')
    for (const block of msg.content ?? []) if (block.type === 'tool-call') openCalls.add(block.id)
    if (msg.role === 'tool') {
      const id = msg.toolCallId ?? msg.source?.callId
      if (!openCalls.delete(id)) throw new Error('Tool result must follow its corresponding call')
    }
  }
  if (openCalls.size) throw new Error('Native tool transaction is incomplete')
  if (!messages.length) diagnostics.push({ code: 'ASSEMBLY_EMPTY' })
  else if (messages.every(m => m.role === 'system')) diagnostics.push({ code: 'ASSEMBLY_SYSTEM_ONLY' })
  const extraBytes = Buffer.byteLength(JSON.stringify(messages.filter(m => !required.includes(m.id))))
  if (extraBytes > maxBytes) throw Object.assign(new Error(`Assembled content exceeds ${maxBytes} bytes`), { status: 413 })
  // Duplicate immutable snapshots can refer to the same content; ids must still be unique per request.
  const ids = new Set()
  messages = messages.map(m => { if (!ids.has(m.id)) { ids.add(m.id); return m }; return { ...m, id: randomUUID() } })
  expanded = expanded.map(node => ({ ...node, start: node.messages?.length ? messages.findIndex(m => m.id === node.messages[0].id) : node.start, count: node.messages?.length ?? node.count,
    requestMessageIds: (node.messages ?? []).map(m => m.id),
  })).sort((a, b) => a.start - b.start)
  const result = { messages, nodes: expanded.map(({ messages: omitted, ...node }) => node), snapshots: nextSnapshots,
    diagnostics, ...(placementControls ? { placementControls } : {}), sources: entries.map(e => e.descriptor), extraBytes, preset: { id: suppliedPreset.id ?? null, name: preset.name, revision: hash(preset) },
    preview, toolsSeparate: true, evaluatedAt: 'request-assembly', compatibility: preset.placement === 'st' ? 'ST ordering, roles, supported macros and depths; not full ST runtime parity' : null }
  // Final message roles include native placement adaptation.
  for (const node of result.nodes) node.messageRoles = node.role === 'preserve' ? node.messageRoles : [node.role]
  result.resourceLayout = describeResourceLayout(result.nodes, preset, slots)
  result.resourceLayout.priorityOrder = priorityOrder(preset)
  result.resourceLayout.positionDecisions = [
    ...new Map(positionEvents.map(e => [positionKey(e.sourceId, e.positionId), e])).values(),
    ...result.nodes.map(n => ({ sourceId: n.source?.module, positionId: n.positionId, nodeId: n.id, decision: n.positionDecision ?? (n.lifetime === 'native' || n.lifetime === 'snapshot' ? 'runtime' : 'source'), slotId: n.slotId ?? null })),
    ...result.nodes.flatMap(n => (n.children ?? []).filter(c => c.positionId).map(c => ({ sourceId: c.source?.module, positionId: c.positionId, decision: c.positionDecision ?? 'preset' }))),
    ...diagnostics.filter(d => ['POSITION_CONFLICT', 'POSITION_ANCHOR_MISSING', 'POSITION_SOURCE_MISSING'].includes(d.code)).map(d => ({ ...d, decision: d.winner ?? 'unavailable' })),
  ]
  afterAssembly?.(result, request)
  return result
}
