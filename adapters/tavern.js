import { RequestSourceRegistry } from '../src/registry.js'
import { normalizePreset, FORMAT } from '../src/model.js'
import { registerDshSources } from './dsh.js'
import { renderSillyTavernMacros } from './tavern-macros.js'
const textOf = m => (m.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n')
const text = (id, value, extra = {}) => ({ type: 'text', id, text: value ?? '', ...extra, stability: /\{\{\s*(random::|roll |getvar::)/i.test(value ?? '') ? 'evaluation' : /last(user|char)message/i.test(value ?? '') ? 'conversation' : extra.stability })
const ref = (id, sourceId, blockIds, extra = {}) => ({ type: 'reference', id, sourceId, blockIds, ...extra })
function references(blocks, id, name) {
  if (['chatHistory', 'history'].includes(name)) { blocks.push(ref(`${id}:history`, 'history', undefined, { owner: id })); if (name === 'chatHistory') blocks.push(ref(`${id}:input`, 'input', undefined, { owner: id })) }
  else if (name === 'input') blocks.push(ref(`${id}:input`, 'input', undefined, { owner: id }))
  else { if (name !== 'worldInfoAfter') blocks.push(ref(`${id}:before`, 'worldbook', undefined, { group: 'before', owner: id })); if (name !== 'worldInfoBefore') blocks.push(ref(`${id}:after`, 'worldbook', undefined, { group: 'after', owner: id })) }
}
// Tavern-authored text uses one reference parser, whether supplied by a preset
// or a custom rule. Source resolvers still own their own compilation semantics.
function tavernText(blocks, id, raw, extra) {
  const matches = [...raw.matchAll(/\{\{\s*(chatHistory|history|input|worldInfoBefore|worldInfoAfter|worldInfo)\s*\}\}/g)]
  if (!matches.length) { blocks.push(text(id, raw, extra)); return }
  let offset = 0
  for (const match of matches) {
    blocks.push(text(`${id}:text:${offset}`, raw.slice(offset, match.index), extra))
    references(blocks, `${id}:${offset}`, match[1]); offset = match.index + match[0].length
  }
  blocks.push(text(`${id}:text:${offset}`, raw.slice(offset), extra))
}
function characterFields(assets) {
  const data = assets.character?.data ?? {}, selection = assets.characterSelection ?? {}
  return { description: data.description ?? '', personality: data.personality ?? '', scenario: data.scenario ?? '', examples: data.messageExample ?? data.mes_example ?? '',
    system: selection.preferCharacterSystemPrompt === false ? '' : data.systemPrompt ?? data.system_prompt ?? '',
    phi: selection.preferCharacterPostHistory === false ? '' : data.postHistoryInstructions ?? data.post_history_instructions ?? '' }
}
/** No privileged registration path: these descriptors also serve the public UI catalog. */
export function registerTavernSources(registry, { worldbookPolicy, worldbookValidateResolved } = {}) {
  const dispose = [], register = source => dispose.push(registry.register({ pluginId: 'pmp-dsh-tavern', stability: 'asset', renderText: renderTavernText, ...source }))
  register({ id: 'character', name: '角色卡', resolve({ assets, preset, nativeMessages }, rule) {
    const fields = characterFields(assets), data = assets.character?.data ?? {}, selection = assets.characterSelection ?? {}
    const blocks = Object.entries(fields).map(([id, value]) => text(id, value, { referenceOnly: id === 'phi', source: { resourceId: assets.character?.id, field: id } }))
    // The opening assistant reference precedes the conversation even when a
    // preset's chatHistory marker has already claimed history/current input.
    // Use the existing depth placement so it cannot split a tool transaction.
    if (assets.includeGreetingReference) { const i = selection.greetingIndex ?? 0; blocks.push(text('greeting', i > 0 ? (data.alternateGreetings ?? data.alternate_greetings ?? [])[i - 1] : data.firstMessage ?? data.first_mes, { role: 'assistant', depth: rule.depth ?? Math.max(1, nativeMessages.filter(m => m.role !== 'system').length), source: { resourceId: assets.character?.id, field: 'greeting' } })) }
    const dp = data.extensions?.depth_prompt
    if (dp?.prompt) blocks.push(text('depth_prompt', dp.prompt, { role: dp.role ?? 'system', depth: dp.depth ?? 4, source: { resourceId: assets.character?.id, field: 'depth_prompt' } }))
    return { blocks, macros: { description: 'description', personality: 'personality', scenario: 'scenario', mesexamples: 'examples', charDescription: 'description', charPersonality: 'personality' } }
  } })
  register({ id: 'persona', name: '用户设定', resolve: ({ assets }) => ({ blocks: [text('persona', assets.user?.description, { source: { resourceId: assets.user?.id, field: 'persona' } })], macros: { persona: 'persona' } }) })
  register({ id: 'worldbook', name: '世界书', stability: 'conversation', validateResolved: worldbookValidateResolved, resolve: context => { const { assets, preset } = context; const output = { blocks: (assets.loreEntries ?? []).map(e => text(`worldbook:${e.id ?? e.uid}`, e.content, {
    name: e.comment || `worldbook:${e.id ?? e.uid}`, group: e.position ?? 'after', stability: e.constant ? 'asset' : 'conversation', role: e.role ?? 'system',
    ...(e.requestedPosition === 'at_depth' ? { depth: e.depth ?? 0 } : {}), source: { resourceId: e.resourceId, field: String(e.uid ?? e.id) },
  })) }; return worldbookPolicy ? worldbookPolicy(context, output) : output } })
  register({ id: 'preset', name: '预设正文', parseText: parseTavernText, lifetimes: ['request'], dependencies: ['character', 'persona', 'history', 'input', 'worldbook', 'phi'], resolve({ assets, preset }) {
    const blocks = [], diagnostics = [], fields = characterFields(assets)
    const markerFields = { charDescription: ['character', 'description'], charPersonality: ['character', 'personality'], scenario: ['character', 'scenario'], dialogueExamples: ['character', 'examples'], personaDescription: ['persona', 'persona'], userDescription: ['persona', 'persona'], userPersona: ['persona', 'persona'] }
    for (const p of assets.preset?.prompts ?? []) {
      if (!p.enabled) continue
      const id = `preset:${p.identifier}`
      if (p.marker) {
        if (markerFields[p.identifier]) { const [sourceId, field] = markerFields[p.identifier]; blocks.push(ref(id, sourceId, [field], { honorEnabled: false, useOwnerRule: true, owner: id })) }
        else if (['chatHistory', 'worldInfoBefore', 'worldInfoAfter'].includes(p.identifier)) references(blocks, id, p.identifier)
        else diagnostics.push({ code: 'UNSUPPORTED_MARKER', owner: id })
        continue
      }
      let raw = p.content ?? '', claims = []
      const field = p.identifier === 'main' ? 'system' : p.identifier === 'jailbreak' ? 'phi' : null
      if (field && fields[field] && !p.st?.forbid_overrides) { raw = fields[field].replace(/\{\{\s*original\s*\}\}/gi, raw); claims.push({ sourceId: 'character', blockId: field }) }
      const src = { resourceId: assets.preset?.id, field: p.identifier }
      const toPhi = preset.placement !== 'st' && p.identifier === 'jailbreak' && preset.rules.some(r => r.kind === 'phi' && r.enabled)
      tavernText(blocks, id, raw, { name: p.name, role: p.role, source: src, claims, ...(toPhi ? { targetSourceId: 'phi' } : {}), ...(p.injectionPosition === 1 ? { depth: p.injectionDepth ?? 0, order: p.injectionOrder ?? p.st?.injection_order ?? 100 } : {}) })
    }
    return { blocks, diagnostics }
  } })
  register({ id: 'phi', name: '后置指令（PHI）', dependencies: ['character'], resolve: (_, rule) => ({ blocks: [ref('phi', 'character', ['phi'], { honorEnabled: false, useOwnerRule: true, lock: false, owner: 'phi' }), text('additional-phi', rule.text, { source: { field: rule.id } })] }) })
  register({ id: 'custom', name: '自定义内容', parseText: parseTavernText, roles: ['user', 'system', 'assistant'], multiple: true, dependencies: ['character', 'persona', 'history', 'input', 'worldbook'], resolve: (_, rule) => {
    const blocks = []
    tavernText(blocks, rule.name || 'custom', rule.text, { source: { field: rule.id } })
    return { blocks }
  } })
  return () => dispose.reverse().forEach(fn => fn())
}
export function registerBuiltinSources(registry, options) { const native = registerDshSources(registry, { sectionPlugin: section => section.plugin ?? section.source?.plugin ?? (section.name === 'rp:policy' || section.name?.startsWith('pmp-dsh-tavern:') ? 'pmp-dsh-tavern' : null) }); try { const tavern = registerTavernSources(registry, options); return () => { tavern(); native() } } catch (error) { native(); throw error } }
export function createDefaultRegistry(options) { const registry = new RequestSourceRegistry(); registerBuiltinSources(registry, options); return registry }

export const DEFAULT_RULES = Object.freeze([
  { id: 'native-system', kind: 'native-system', enabled: true },
  { id: 'preset', kind: 'preset', enabled: true },
  { id: 'persona', kind: 'persona', enabled: true },
  { id: 'character', kind: 'character', enabled: true },
  { id: 'worldbook', kind: 'worldbook', enabled: true },
  { id: 'history', kind: 'history', enabled: true },
  { id: 'input', kind: 'input', enabled: true },
  { id: 'phi', kind: 'phi', enabled: true },
])
export const BUILTINS = Object.freeze([
  { id: 'builtin-st', ...normalizePreset({ format: FORMAT, version: 1, name: 'ST 兼容 / ST compatible', placement: 'st', rules: DEFAULT_RULES }) },
  { id: 'builtin-cache', ...normalizePreset({ format: FORMAT, version: 1, name: '缓存友好 / Cache friendly', rules: [DEFAULT_RULES[0], DEFAULT_RULES[1], DEFAULT_RULES[2], DEFAULT_RULES[3], DEFAULT_RULES[5], DEFAULT_RULES[6], DEFAULT_RULES[4], DEFAULT_RULES[7]] }) },
  { id: 'builtin-snapshots', ...normalizePreset({ format: FORMAT, version: 1, name: '追加快照 / Append snapshots', rules: [DEFAULT_RULES[0], DEFAULT_RULES[1], DEFAULT_RULES[2], DEFAULT_RULES[3], DEFAULT_RULES[5], DEFAULT_RULES[6], { ...DEFAULT_RULES[4], lifetime: 'snapshot' }, DEFAULT_RULES[7]] }) },
])

export function renderTavernText({ text, context, variables, block, diagnostics, identity }) {
  for (const match of text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) if (!Object.hasOwn(block.literalMacros ?? {}, match[1]) && !/^(user|char|lastusermessage|lastcharmessage|trim|random::|roll |setvar::|getvar::|\/\/)/i.test(match[1])) diagnostics.push({ code: 'UNSUPPORTED_MACRO', macro: match[1], owner: identity })
  const data = context.assets.character?.data ?? {}
  const macros = { ...context.assets.context, user: context.assets.user?.name ?? context.assets.context?.user ?? 'User', character: data.nickname || data.name || context.assets.character?.name || 'Assistant',
    lastUserMessage: textOf(context.nativeMessages.findLast(m => m.role === 'user' && (m.source?.kind === 'user' || !m.source)) ?? {}), lastAssistantMessage: textOf(context.nativeMessages.findLast(m => m.role === 'assistant') ?? {}), ...(context.preview ? { random: () => 0.5 } : {}) }
  return renderSillyTavernMacros(text, macros, variables, { literalMacros: block.literalMacros })
}
export function parseTavernText(context, rule) { const blocks = []; tavernText(blocks, rule.name || 'custom', rule.text, { source: { field: rule.id } }); return { blocks } }

export function registerTavernTemplateSource(registry, service) {
  return registry.register({ id: 'pmp-dsh-tavern/prompt-template', pluginId: 'pmp-dsh-tavern', name: '提示词模板 / Prompt Template (read-only subset)', stability: 'evaluation', lifetimes: ['request'], renderText: renderTavernText,
    resolve: context => service.resolve(context), validateResolved: context => service.validateResolved(context) })
}
export function registerTavernMvuSource(registry, service) {
  return registry.register({ id: 'tavern.mvu/state', pluginId: 'pmp-dsh-tavern', name: 'MVU state', stability: 'conversation', roles: ['system'], lifetimes: ['request'], depth: true, renderText: renderTavernText,
    resolve: context => service.resolveRequest(context), validateResolved: context => service.validateResolved(context) })
}
export function diagnoseTavernAssembly(assembly, context) {
  const firstInput = assembly.messages.findIndex(m => context.inputIds.includes(m.id))
  for (const node of assembly.nodes) if (node.module === 'character' && node.source?.field === 'greeting' && node.role === 'assistant' && firstInput >= 0 && node.start > firstInput) {
    assembly.diagnostics.push({ code: 'GREETING_AFTER_INPUT', id: node.id, message: 'The configured greeting depth places an assistant reference after current input; following system updates may be unsupported by the selected model.' })
  }
}

export const MODULES = Object.freeze(['native-system', 'preset', 'character', 'persona', 'worldbook', 'history', 'input', 'phi', 'custom'])
