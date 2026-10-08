import { contentGuides } from './content-guides.js'
import { RequestSourceRegistry } from '../src/registry.js'
import { normalizePreset, FORMAT } from '../src/model.js'
import { registerDshSources } from './dsh.js'
import { renderSillyTavernMacros } from './tavern-macros.js'
const templateParsers = new WeakMap()
const unifiedChecks = new WeakMap()
const textOf = m => (m.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n')
const text = (id, value, extra = {}) => ({ type: 'text', id, text: value ?? '', ...extra, stability: /\{\{\s*(random::|roll |getvar::)/i.test(value ?? '') ? 'evaluation' : /last(user|char)message/i.test(value ?? '') ? 'conversation' : extra.stability })
const ref = (id, sourceId, blockIds, extra = {}) => ({ type: 'reference', id, sourceId, blockIds, ...extra })
function references(blocks, id, name, extra = {}) {
  if (['chatHistory', 'history'].includes(name)) { blocks.push(ref(`${id}:history`, 'history', undefined, { owner: id, ...extra })); if (name === 'chatHistory') blocks.push(ref(`${id}:input`, 'input', undefined, { owner: id, ...extra })) }
  else if (name === 'input') blocks.push(ref(`${id}:input`, 'input', undefined, { owner: id, ...extra }))
  else { if (name !== 'worldInfoAfter') blocks.push(ref(`${id}:before`, 'worldbook', undefined, { group: 'before', owner: id, ...extra })); if (name !== 'worldInfoBefore') blocks.push(ref(`${id}:after`, 'worldbook', undefined, { group: 'after', owner: id, ...extra })) }
}
// Tavern-authored text uses one reference parser, whether supplied by a preset
// or a custom rule. Source resolvers still own their own compilation semantics.
function tavernText(blocks, id, raw, extra) {
  const matches = [...raw.matchAll(/\{\{\s*(chatHistory|history|input|worldInfoBefore|worldInfoAfter|worldInfo)\s*\}\}/g)]
  if (!matches.length) { blocks.push(text(id, raw, extra)); return }
  let offset = 0
  for (const match of matches) {
    blocks.push(text(`${id}:text:${offset}`, raw.slice(offset, match.index), extra))
    references(blocks, `${id}:${offset}`, match[1], { role: extra?.role }); offset = match.index + match[0].length
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
  const dispose = [], register = source => dispose.push(registry.register({ pluginId: 'pmp-dsh-tavern', stability: 'asset', renderText: renderTavernText, contentGuide: contentGuides[source.id], ...source }))
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
  register({ id: 'preset', name: '预设正文', textParserAliasFor: 'tavern.text', parseText: parseTavernText, lifetimes: ['request'], dependencies: ['character', 'persona', 'history', 'input', 'worldbook', 'phi'], resolve({ assets, preset }) {
    const blocks = [], diagnostics = [], fields = characterFields(assets)
    const markerFields = { charDescription: ['character', 'description'], charPersonality: ['character', 'personality'], scenario: ['character', 'scenario'], dialogueExamples: ['character', 'examples'], personaDescription: ['persona', 'persona'], userDescription: ['persona', 'persona'], userPersona: ['persona', 'persona'] }
    for (const p of assets.preset?.prompts ?? []) {
      if (!p.enabled) continue
      const id = `preset:${p.identifier}`
      if (p.marker) {
        if (markerFields[p.identifier]) { const [sourceId, field] = markerFields[p.identifier]; blocks.push(ref(id, sourceId, [field], { honorEnabled: false, useOwnerRule: true, owner: id, role: p.role })) }
        else if (['chatHistory', 'history', 'input', 'worldInfoBefore', 'worldInfoAfter'].includes(p.identifier)) references(blocks, id, p.identifier, { role: p.role })
        else diagnostics.push({ code: 'UNSUPPORTED_MARKER', owner: id })
        continue
      }
      let raw = p.content ?? '', claims = []
      const field = p.identifier === 'main' ? 'system' : p.identifier === 'jailbreak' ? 'phi' : null
      if (field && fields[field] && !p.st?.forbid_overrides) { raw = fields[field].replace(/\{\{\s*original\s*\}\}/gi, raw); claims.push({ sourceId: 'character', blockId: field }) }
      const src = { resourceId: assets.preset?.id, field: p.identifier }
      const toPhi = !['st', 'native-roles', 'native-slots'].includes(preset.placement) && p.identifier === 'jailbreak' && preset.rules.some(r => r.kind === 'phi' && r.enabled)
      tavernText(blocks, id, raw, { name: p.name, role: p.role, source: src, claims, ...(toPhi ? { targetSourceId: 'phi' } : {}), ...(p.injectionPosition === 1 ? { depth: p.injectionDepth ?? 0, order: p.injectionOrder ?? p.st?.injection_order ?? 100 } : {}) })
    }
    return { blocks, diagnostics }
  } })
  register({ id: 'phi', name: '后置指令（PHI）', dependencies: ['character'], resolve: (_, rule) => ({ blocks: [ref('phi', 'character', ['phi'], { honorEnabled: false, useOwnerRule: true, lock: false, owner: 'phi' }), text('additional-phi', rule.text, { source: { field: rule.id } })] }) })
  register({ id: 'custom', name: '自定义内容', textParserAliasFor: 'tavern.text', supportsModule: false, parseText: parseTavernText, roles: ['user', 'system', 'assistant'], multiple: true, dependencies: ['character', 'persona', 'history', 'input', 'worldbook'], resolve: (_, rule) => {
    const blocks = []
    tavernText(blocks, rule.name || 'custom', rule.text, { source: { field: rule.id } })
    return { blocks }
  } })
  register({ id: 'tavern.text', name: 'Tavern 文本解析器', supportsModule: false, multiple: true, roles: ['preserve', 'user', 'system', 'assistant'], lifetimes: ['request'], stability: 'evaluation', dependencies: ['character', 'persona', 'history', 'input', 'worldbook'],
    parseText: (context, rule) => parseUnifiedTavernText(registry, context, rule), validateResolved: context => unifiedChecks.get(context)?.() })
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

export const NATIVE_RULES = Object.freeze([
  ...DEFAULT_RULES.filter(r => !['history', 'input', 'phi'].includes(r.kind)).map(r => ({ ...r, role: r.kind === 'native-system' ? 'preserve' : 'system' })),
  { ...DEFAULT_RULES[7], role: 'system' }, DEFAULT_RULES[5], DEFAULT_RULES[6],
])
export const NATIVE_BUILTINS = Object.freeze([
  { id: 'builtin-native-st', ...normalizePreset({ format: FORMAT, version: 1, backend: 'native', name: 'ST 风格（原生） / ST style (native)', rules: NATIVE_RULES }) },
  { id: 'builtin-native-cache', ...normalizePreset({ format: FORMAT, version: 1, backend: 'native', name: '缓存友好（原生） / Cache friendly (native)', rules: [...NATIVE_RULES.filter(r => !['worldbook', 'phi'].includes(r.kind)), { ...DEFAULT_RULES[4], role: 'user', delivery: 'context' }, { ...DEFAULT_RULES[7], role: 'user', delivery: 'pre-step' }] }) },
  { id: 'builtin-native-phi', ...normalizePreset({ format: FORMAT, version: 1, backend: 'native', name: '后置提醒（原生） / Final reminder (native)', rules: [...NATIVE_RULES.filter(r => r.kind !== 'phi'), { ...DEFAULT_RULES[7], role: 'user', delivery: 'pre-step' }] }) },
  { id: 'builtin-native-roles', ...normalizePreset({ format: FORMAT, version: 1, backend: 'native', name: '预设身份优先（原生） / Preset roles first (native)', placement: 'native-roles', rules: DEFAULT_RULES }) },
  { id: 'builtin-native-slots', ...normalizePreset({ format: FORMAT, version: 1, backend: 'native', name: '预设插槽优先（原生） / Preset slots first (native)', placement: 'native-slots', rules: DEFAULT_RULES }) },
])

export function renderTavernText({ text, context, variables, block, diagnostics, identity }) {
  for (const match of text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) if (!Object.hasOwn(block.literalMacros ?? {}, match[1]) && !/^(user|char|lastusermessage|lastcharmessage|trim|random::|roll |setvar::|getvar::|\/\/)/i.test(match[1])) diagnostics.push({ code: 'UNSUPPORTED_MACRO', macro: match[1], owner: identity })
  const data = context.assets.character?.data ?? {}
  const macros = { ...context.assets.context, user: context.assets.user?.name ?? context.assets.context?.user ?? 'User', character: data.nickname || data.name || context.assets.character?.name || 'Assistant',
    lastUserMessage: textOf(context.nativeMessages.findLast(m => m.role === 'user' && (m.source?.kind === 'user' || !m.source)) ?? {}), lastAssistantMessage: textOf(context.nativeMessages.findLast(m => m.role === 'assistant') ?? {}), ...(context.preview ? { random: () => 0.5 } : {}) }
  return renderSillyTavernMacros(text, macros, variables, { literalMacros: block.literalMacros })
}
export function parseTavernText(context, rule) { const blocks = []; tavernText(blocks, rule.name || 'custom', rule.text, { source: { field: rule.id } }); return { blocks } }

function parseUnifiedTavernText(registry, context, rule) {
  if (!rule.text.includes('<%')) return parseTavernText(context, rule)
  const service = templateParsers.get(registry)
  if (!service?.parseText) throw Object.assign(new Error('Tavern EJS text service is unavailable'), { code: 'TAVERN_TEMPLATE_PARSER_UNAVAILABLE' })
  unifiedChecks.set(context, () => {
    if (templateParsers.get(registry) !== service) throw Object.assign(new Error('Tavern EJS parser changed during assembly'), { code: 'TAVERN_TEMPLATE_PARSER_UNAVAILABLE' })
    service.validateResolved(context)
  })
  return Promise.resolve(service.parseText(context, rule)).then(output => {
    const blocks = []
    for (const block of output.blocks) {
      const { id, text: raw, type, ...extra } = block
      tavernText(blocks, id, raw, extra)
    }
    // Preserve source-authorized dependency receipts under the actual emitted
    // text blocks; authored EJS is evaluated once before references/macros.
    const diagnostics = (output.diagnostics ?? []).flatMap(fact => {
      if (typeof fact.blockId !== 'string') return [fact]
      const emitted = blocks.filter(b => b.type === 'text' && b.text && (b.id === fact.blockId || b.id.startsWith(fact.blockId + ':')))
      return emitted.length ? emitted.map(b => ({ ...fact, sourceId: 'tavern.text', blockId: b.id })) : [{ ...fact, sourceId: 'tavern.text' }]
    })
    return { ...output, blocks, diagnostics }
  })
}
export function registerTavernTemplateSource(registry, service) {
  const stop = registry.register({ id: 'pmp-dsh-tavern/prompt-template', textParserAliasFor: 'tavern.text', contentGuide: contentGuides['pmp-dsh-tavern/prompt-template'], pluginId: 'pmp-dsh-tavern', name: '提示词模板 / Prompt Template (read-only subset)', stability: 'evaluation', lifetimes: ['request'], renderText: renderTavernText,
    moduleAvailable: scope => service.hasModule?.(scope) === true, parseText: typeof service.parseText === 'function' ? (context, rule) => service.parseText(context, rule) : undefined,
    resolve: context => service.resolve(context), validateResolved: context => service.validateResolved(context) })
  templateParsers.set(registry, service)
  return () => { stop(); if (templateParsers.get(registry) === service) templateParsers.delete(registry) }
}
export function registerTavernMvuSource(registry, service) {
  return registry.register({ id: 'tavern.mvu/state', contentGuide: contentGuides['tavern.mvu/state'], pluginId: 'pmp-dsh-tavern', name: 'MVU state', stability: 'conversation', roles: ['system'], lifetimes: ['request'], depth: true, renderText: renderTavernText,
    moduleAvailable: scope => service.hasModule?.(scope) === true,
    resolve: context => service.resolveRequest(context), validateResolved: context => service.validateResolved(context) })
}
export function diagnoseTavernAssembly(assembly, context) {
  const firstInput = assembly.messages.findIndex(m => context.inputIds.includes(m.id))
  for (const node of assembly.nodes) if (node.module === 'character' && node.source?.field === 'greeting' && node.role === 'assistant' && firstInput >= 0 && node.start > firstInput) {
    assembly.diagnostics.push({ code: 'GREETING_AFTER_INPUT', id: node.id, message: 'The configured greeting depth places an assistant reference after current input; following system updates may be unsupported by the selected model.' })
  }
}

export const MODULES = Object.freeze(['native-system', 'preset', 'character', 'persona', 'worldbook', 'history', 'input', 'phi', 'custom'])
