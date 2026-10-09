export const DEFAULT_HISTORY_POLICY = Object.freeze({
  version: 1, enabled: false, sources: [
    { kind: 'dsh-prompt-assembler', include: false },
    { kind: 'runtime-context', include: false },
    { kind: 'system-prompt', include: false },
    { kind: 'ptc-mode', include: false },
    { kind: 'tool', include: false },
  ], contentTypes: { text: true, image: true, reasoning: false }, fragments: [],
})
const bad = message => { throw Object.assign(new TypeError(message), { status: 400, code: 'HISTORY_POLICY_INVALID' }) }
const keys = (value, allowed) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) bad('Unknown history policy field')
}
export function normalizeHistoryPolicy(input = DEFAULT_HISTORY_POLICY) {
  keys(input, ['version', 'enabled', 'sources', 'contentTypes', 'fragments'])
  if (input.version !== 1 || typeof input.enabled !== 'boolean') bad('Expected policy version 1 and enabled boolean')
  if (!Array.isArray(input.sources) || input.sources.length > 100 || !Array.isArray(input.fragments) || input.fragments.length > 100) bad('Too many or invalid rules')
  const sources = input.sources.map(rule => {
    keys(rule, ['kind', 'include'])
    if (typeof rule.kind !== 'string' || !/^[\w.:/-]{1,160}$/.test(rule.kind) || typeof rule.include !== 'boolean') bad('Invalid source selector')
    return { ...rule }
  })
  if (new Set(sources.map(s => s.kind)).size !== sources.length) bad('Duplicate source selector')
  keys(input.contentTypes, ['text', 'image', 'reasoning'])
  if (['text', 'image', 'reasoning'].some(k => typeof input.contentTypes[k] !== 'boolean')) bad('Content type controls must be boolean')
  const fragments = input.fragments.map(rule => {
    keys(rule, ['id', 'sourceKind', 'start', 'end', 'mode', 'enabled'])
    if (typeof rule.id !== 'string' || !/^[\w.-]{1,80}$/.test(rule.id) || typeof rule.sourceKind !== 'string' || !/^[\w.:/-]{1,160}$/.test(rule.sourceKind)) bad('Invalid fragment identity/source')
    if ([rule.start, rule.end].some(v => typeof v !== 'string' || !v.trim() || v.length > 256 || /[\r\n]/.test(v)) || rule.start === rule.end) bad('Use distinct nonempty single-line delimiters')
    if (!['lines', 'literal'].includes(rule.mode) || typeof rule.enabled !== 'boolean') bad('Invalid fragment mode')
    return { ...rule }
  })
  if (new Set(fragments.map(r => r.id)).size !== fragments.length) bad('Duplicate fragment rule id')
  return { version: 1, enabled: input.enabled, sources, contentTypes: { ...input.contentTypes }, fragments }
}

