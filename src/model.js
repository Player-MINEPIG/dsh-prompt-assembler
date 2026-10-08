export const FORMAT = 'dsh-tavern-request-assembly'
export const MODULES = Object.freeze(['native-system', 'history', 'input', 'dsh.text'])
export const DEFAULT_RULES = Object.freeze(['native-system', 'history', 'input'].map(kind => ({ id: kind, kind, enabled: true })))
export function normalizePreset(value) {
  if (!value || value.format !== FORMAT || value.version !== 1) throw new TypeError('Unsupported assembly preset format/version')
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 200) throw new TypeError('Preset name is required (max 200 characters)')
  if (!Array.isArray(value.rules) || value.rules.length > 128) throw new TypeError('Expected at most 128 assembly rules')
  if (value.backend !== undefined && !['native', 'core'].includes(value.backend)) throw new TypeError('Invalid assembly backend')
  const ids = new Set(), kinds = new Set()
  const rules = value.rules.map(rule => {
    if (!rule || !/^[a-zA-Z0-9_-]{1,80}$/.test(rule.id) || ids.has(rule.id)) throw new TypeError('Rule ids must be unique')
    if (typeof rule.kind !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,159}$/.test(rule.kind)) throw new TypeError('Invalid or duplicate module')
    ids.add(rule.id); kinds.add(rule.kind)
    if (rule.delivery !== undefined && !['context', 'pre-step'].includes(rule.delivery)) throw new TypeError('Invalid native user delivery')
    const role = ['custom', 'dsh.text'].includes(rule.kind) ? (rule.role === 'preserve' ? 'system' : rule.role ?? 'user') : rule.role ?? 'preserve', lifetime = rule.lifetime ?? 'request'
    if (!['preserve', 'system', 'user', 'assistant'].includes(role)) throw new TypeError('Invalid role')
    if (!['request', 'snapshot'].includes(lifetime)) throw new TypeError('Invalid lifetime')
    if (rule.depth !== undefined && rule.depth !== null && (!Number.isInteger(rule.depth) || rule.depth < 0 || rule.depth > 10000)) throw new TypeError('Invalid insertion depth')
    if (typeof (rule.text ?? '') !== 'string' || (rule.text ?? '').length > 524288) throw new TypeError('Custom text exceeds limit')
    if (rule.inputMode !== undefined && !['source', 'text'].includes(rule.inputMode)) throw new TypeError('Invalid rule inputMode')
    return { ...(rule.delivery ? { delivery: rule.delivery } : {}), ...(rule.inputMode === 'text' ? { inputMode: 'text' } : {}), id: rule.id, kind: rule.kind, enabled: rule.enabled !== false, role, lifetime, depth: rule.depth ?? null, text: rule.text ?? '', name: typeof rule.name === 'string' ? rule.name.slice(0, 200) : '' }
  })
  return { ...(value.backend ? { backend: value.backend } : {}), format: FORMAT, version: 1, name: value.name.trim(), placement: ['st', 'native-roles', 'native-slots'].includes(value.placement) ? value.placement : 'modules', rules }
}
export const BUILTINS = Object.freeze([{ id: 'builtin-native', ...normalizePreset({ format: FORMAT, version: 1, name: 'DSH 原生 / DSH native', backend: 'native', rules: DEFAULT_RULES }) }])
export function moveRule(rules, id, targetId) {
  const from = rules.findIndex(r => r.id === id), to = rules.findIndex(r => r.id === targetId)
  if (from < 0 || to < 0 || from === to) return rules
  const copy = [...rules], [item] = copy.splice(from, 1); copy.splice(to, 0, item); return copy
}
