import { contentGuides } from './content-guides.js'
import { RequestSourceRegistry } from '../src/registry.js'
const textOf = m => (m.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n')
const native = (id, name, sectionPlugin = section => section.plugin ?? section.source?.plugin ?? null) => ({ id, pluginId: 'DSH', name, contentGuide: contentGuides[id], roles: ['preserve'], lifetimes: ['request'], depth: false, generationRequiresPlugin: false, stability: id === 'native-system' ? 'assembly' : 'conversation', resolve(context) {
  const claimed = new Set(context.inputIds)
  const messages = context.nativeMessages.filter(m => id === 'native-system' ? m.role === 'system' : m.role !== 'system' && (id === 'input' ? claimed.has(m.id) : !claimed.has(m.id)))
  const children = id === 'native-system' ? (context.assets.officialSections ?? []).map((s, i) => ({ id: `official:${i}`, name: s.name, text: s.text, locked: true, lockReason: 'native-system-section', source: { plugin: sectionPlugin(s), providedBy: 'DSH', section: s.name, generationRequiresPlugin: null, recordedContentSurvivesRemoval: true } }))
    : messages.map(m => ({ id: m.id, name: m.role, text: textOf(m), locked: true, lockReason: 'native-message', source: { plugin: m.source?.plugin ?? 'DSH', sourceKind: m.source?.kind ?? 'unknown', generationRequiresPlugin: Boolean(m.source?.plugin), recordedContentSurvivesRemoval: true } }))
  if (id !== 'native-system') return { blocks: [{ type: 'native', id, messageIds: messages.map(m => m.id), children }] }
  const enabled = kind => !context.preset.rules.some(rule => rule.kind === kind) || context.preset.rules.some(rule => rule.kind === kind && rule.enabled)
  const included = m => m.role !== 'system' && enabled(claimed.has(m.id) ? 'input' : 'history')
  return { blocks: messages.map((message, index) => {
    const nativeIndex = context.nativeMessages.indexOf(message)
    // An empty native head may have been filtered out: even the first visible
    // system is an update when conversation messages precede it.
    const followsConversation = context.nativeMessages.slice(0, nativeIndex).some(included)
    return { type: 'native', id: index === 0 ? id : `${id}:${message.id}`, messageIds: [message.id],
      ...(followsConversation ? { depth: context.nativeMessages.slice(nativeIndex + 1).filter(included).length } : {}),
      children: index === messages.length - 1 ? children : [],
    }
  }) }
} })

export function parseDshText(context, rule) {
  const variables = context.assets.nativeVariables ?? {}
  const text = rule.text.replace(/\{\{([^{}]*)\}\}/g, (_, key) => {
    if (!/^[a-z][a-z0-9_]*$/.test(key) || typeof variables[key] !== 'string') throw Object.assign(new Error(`Native variable "${key}" is unavailable`), { code: 'NATIVE_TEXT_VARIABLE_UNAVAILABLE', status: 409 })
    return variables[key]
  })
  return { blocks: [{ id: 'text', type: 'text', text, source: { field: rule.id } }] }
}
export function registerDshSources(registry, { sectionPlugin } = {}) {
  const stops = []
  try {
    for (const [id, name] of [['native-system', '官方基础指令'], ['history', '原生历史'], ['input', '本步输入']]) stops.push(registry.register(native(id, name, sectionPlugin)))
    stops.push(registry.register({ id: 'dsh.text', pluginId: 'DSH', name: 'DSH 自定义文本', supportsModule: false, multiple: true, roles: ['user', 'system', 'assistant'], renderText: ({ text }) => text, resolve: parseDshText, parseText: parseDshText }))
  } catch (error) { stops.reverse().forEach(stop => stop()); throw error }
  return () => stops.reverse().forEach(stop => stop())
}
export function createDshRegistry() { const registry = new RequestSourceRegistry(); registerDshSources(registry); return registry }
