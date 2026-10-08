const fail = (message, node) => { throw Object.assign(new Error(message), { status: 409, code: 'ASSEMBLY_NATIVE_UNSUPPORTED', detail: node && { ruleId: node.ruleId, field: node.source?.field, name: node.name } }) }
const kind = node => node.source?.module
const presetOwned = node => kind(node) === 'preset' || node.placementSource === 'preset'

/** Project source order onto public native delivery regions, retaining empty anchors. */
export function projectNativeOrder(nodes, preset, diagnostics) {
  const history = nodes.find(n => kind(n) === 'history'), input = nodes.find(n => kind(n) === 'input')
  if (!history || !input) fail('Native ordering requires both history and current-input anchors.')
  const requestedSlots = preset.placement === 'native-slots'
  const historySlot = history.placementSource === 'preset', inputSlot = input.placementSource === 'preset'
  const slots = requestedSlots && (historySlot || inputSlot)
  if (requestedSlots && !slots) diagnostics.push({ code: 'NATIVE_SLOTS_ABSENT' })
  const authored = [...nodes]
  if (slots) {
    // The preset is one immutable spine. Independent modules attach to its
    // native anchors, not to the fallback position of a consumed module row.
    const independent = nodes.filter(n => !presetOwned(n) && n !== history && n !== input)
    const spine = nodes.filter(n => !independent.includes(n))
    const firstPreset = spine.find(presetOwned)
    const anchors = preset.rules.flatMap(r => {
      const node = r.kind === 'preset' ? firstPreset : r.kind === 'history' ? history : r.kind === 'input' ? input : null
      return node ? [{ rule: r, node }] : []
    })
    for (const node of independent) {
      const index = preset.rules.findIndex(r => r.id === node.ruleId)
      const anchor = anchors.find(a => preset.rules.indexOf(a.rule) > index)
      const at = anchor ? spine.indexOf(anchor.node) : spine.length
      spine.splice(at, 0, node)
    }
    nodes.splice(0, nodes.length, ...spine)
  }
  if (slots && nodes.indexOf(history) > nodes.indexOf(input)) {
    if (historySlot && inputSlot) fail('预设将本步输入放在原生历史之前，标准版无法保留此顺序。 / Preset input precedes history; native ordering cannot preserve this sequence.')
    // An absent slot uses a legal native fallback; never relocate an explicit slot.
    nodes.splice(nodes.indexOf(historySlot ? input : history), 1)
    if (historySlot) nodes.push(input)
    else nodes.unshift(history)
  }
  // Native slot depth is a boundary mapping, never an insertion into history.
  const depthNodes = requestedSlots ? nodes.filter(n => kind(n) === 'worldbook' && [0, 1].includes(n.nativeRequestedDepth)) : []
  if (depthNodes.length) {
    const rest = nodes.filter(n => !depthNodes.includes(n))
    const at = rest.indexOf(history)
    const before = depthNodes.filter(n => n.nativeRequestedDepth > 0), after = depthNodes.filter(n => n.nativeRequestedDepth === 0)
    rest.splice(at, 1, ...before, history, ...after)
    for (const node of depthNodes) {
      node.nativeDepthAnchor = node.nativeRequestedDepth === 0 ? 'after-history' : 'before-history'
      node.locked = true; node.lockReason = 'native-depth-boundary'
      diagnostics.push({ code: 'NATIVE_DEPTH_BOUNDARY', id: node.id, name: node.name, depth: node.nativeRequestedDepth, placement: node.nativeDepthAnchor })
    }
    nodes.splice(0, nodes.length, ...rest)
  }
  const historyIndex = nodes.indexOf(history), inputIndex = nodes.indexOf(input)
  const groups = [[], [history], [], [input], [], []]
  for (const node of nodes) {
    if (node === history || node === input) continue
    if (kind(node) === 'native-system') { groups[0].push(node); continue }
    const index = nodes.indexOf(node), rule = preset.rules.find(r => r.id === node.ruleId)
    if (slots && presetOwned(node) || node.nativeDepthAnchor) {
      // A history slot fixes the system/user boundary. With only an input slot,
      // authored system prefixes remain system and user prefixes follow history.
      const role = node.nativeDepthAnchor ? node.nativeDepthAnchor === 'before-history' ? 'system' : 'user'
        : historySlot ? index < historyIndex ? 'system' : 'user' : index > inputIndex ? 'user' : node.role
      if (role !== node.role && preset.layout?.identity === 'preserve') fail('Preserving identity conflicts with this native slot position; explicitly allow position adaptation or use manual layout.', node)
      if (role !== node.role) {
        node.authoredRole = node.role
        diagnostics.push({ code: 'NATIVE_ROLE_ADJUSTED', id: node.id, name: node.name, from: node.role, to: role })
        node.role = role
        node.messages = node.messages.map(m => ({ ...m, role, source: { kind: role === 'system' ? 'system-prompt' : 'tavern-assembly' } }))
      }
    }
    if (!['system', 'user'].includes(node.role)) fail(`Native ordering cannot preserve ${node.role}: ${node.name}`, node)
    if (node.role === 'system') { node.nativePlacement = 'system'; groups[0].push(node); continue }
    // Slot placement needs ordered accepted messages, including the area before
    // input. Context snapshots may be reused at an old position by native DSH.
    node.nativeDelivery = (slots && presetOwned(node) || node.nativeDepthAnchor) ? 'pre-step' : rule?.delivery ?? 'context'
    if ((slots && presetOwned(node) || node.nativeDepthAnchor) && rule?.delivery === 'context') diagnostics.push({ code: 'NATIVE_DELIVERY_ADJUSTED', id: node.id, name: node.name, from: 'context', to: 'pre-step' })
    node.nativePlacement = node.nativeDelivery === 'pre-step' && index < inputIndex ? 'before-input' : 'after-input'
    groups[node.nativePlacement === 'before-input' ? 2 : node.nativeDelivery === 'context' ? 4 : 5].push(node)
  }
  const ordered = groups.flat()
  for (const node of ordered) if (node.lifetime !== 'native' && ordered.indexOf(node) !== authored.indexOf(node)) {
    diagnostics.push({ code: 'NATIVE_PLACEMENT_ADJUSTED', id: node.id, name: node.name, role: node.role, placement: node.nativePlacement })
  }
  nodes.splice(0, nodes.length, ...ordered)
}
