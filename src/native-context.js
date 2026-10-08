// Exact public context names in the supported DSH runtime. Unknown/third-party
// contexts are deliberately retained; role and delivery never establish ownership.
export const DSH_CONTEXT_NAMES = Object.freeze(['sandbox:policy', 'approval:policy', 'subagent:delegation'])
export const CONTEXT_CONTROLS = Object.freeze([
  { kind: 'dsh.runtime-context', name: 'DSH 原生运行环境提示', sections: DSH_CONTEXT_NAMES },
  { kind: 'dsh.sandbox-policy', name: '沙箱策略提示', sections: ['sandbox:policy'] },
  { kind: 'dsh.approval-policy', name: '审批策略提示', sections: ['approval:policy'] },
])
export const isContextControl = kind => CONTEXT_CONTROLS.some(c => c.kind === kind)
export function contextControlRows(rules, available = CONTEXT_CONTROLS.map(c => c.kind)) {
  const ids = new Set(rules.map(r => r.id))
  return [...rules, ...CONTEXT_CONTROLS.filter(c => available.includes(c.kind) && !rules.some(r => r.kind === c.kind)).map(c => {
    let id = c.kind.replaceAll('.', '-')
    while (ids.has(id)) id += '-control'
    ids.add(id)
    return { id, kind: c.kind, enabled: true, role: 'preserve', lifetime: 'request', depth: null, text: '', name: '' }
  })]
}
export function filterNativeContexts(assembly, preset) {
  const disabled = new Set(CONTEXT_CONTROLS.filter(c => preset?.rules.some(r => r.kind === c.kind && r.enabled === false)).flatMap(c => c.sections))
  if (!disabled.size) return assembly
  return { ...assembly, contexts: assembly.contexts.filter(c => !disabled.has(c.name)) }
}
export function contextControlPreview(assembly, preset) {
  const retained = filterNativeContexts(assembly, preset).contexts
  return assembly.contexts.filter(c => DSH_CONTEXT_NAMES.includes(c.name)).map(c => ({ name: c.name, enabled: retained.includes(c) }))
}
