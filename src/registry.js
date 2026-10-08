export const ASSEMBLY_SERVICE = 'dshPromptSources'
export const SOURCE_PROTOCOL_VERSION = 1
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,159}$/
export function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) freeze(child) }
  return value
}
function aborted(signal) { signal?.throwIfAborted() }
async function abortable(value, signal) {
  aborted(signal)
  if (!signal) return value
  let stop
  try { return await Promise.race([Promise.resolve(value), new Promise((_, reject) => { stop = () => reject(signal.reason); signal.addEventListener('abort', stop, { once: true }) })]) }
  finally { signal.removeEventListener('abort', stop) }
}
/** Host-side content sources. Built-ins register through exactly this contract. */
export class RequestSourceRegistry {
  get version() { return SOURCE_PROTOCOL_VERSION }
  #sources = new Map()
  constructor({ renderText = ({ text }) => text } = {}) { this.renderText = renderText }
  register(source) {
    if (!source || !idPattern.test(source.id) || !idPattern.test(source.pluginId) || typeof source.name !== 'string' || !source.name || (typeof source.resolve !== 'function' && typeof source.parseText !== 'function')) throw new TypeError('Source requires id, pluginId, name and resolve or parseText')
    if (this.#sources.has(source.id)) throw new TypeError(`Duplicate assembly source: ${source.id}`)
    const descriptor = freeze(structuredClone({ id: source.id, pluginId: source.pluginId, name: source.name, version: source.version ?? 1,
      ...(source.positions ? { positions: source.positions } : {}), stability: source.stability ?? 'conversation', dependencies: source.dependencies ?? [], multiple: source.multiple === true,
      roles: source.roles ?? ['preserve', 'system', 'user', 'assistant'], lifetimes: source.lifetimes ?? ['request', 'snapshot'], depth: source.depth !== false,
      generationRequiresPlugin: source.generationRequiresPlugin !== false, recordedContentSurvivesRemoval: true, ...(source.textParserAliasFor ? { textParserAliasFor: source.textParserAliasFor } : {}), ...(source.contentGuide ? { contentGuide: source.contentGuide } : {}), acceptsText: typeof source.parseText === 'function', supportsModule: source.supportsModule !== false && typeof source.resolve === 'function',
    }))
    if (descriptor.positions) {
      const positions = descriptor.positions
      if (!Array.isArray(positions) || !positions.length || positions.length > 128) throw new TypeError('Invalid source positions')
      const seen = new Set()
      for (const p of positions) {
        if (!p || typeof p.id !== 'string' || !idPattern.test(p.id) || seen.has(p.id) || !Array.isArray(p.name) || p.name.length !== 2 || p.name.some(n => typeof n !== 'string' || !n)) throw new TypeError('Invalid source position')
        seen.add(p.id)
        if (p.match && Object.entries(p.match).some(([k, v]) => !['field', 'group', 'depth'].includes(k) || (k === 'depth' ? typeof v !== 'boolean' : typeof v !== 'string'))) throw new TypeError('Invalid source position match')
        if (p.configurable !== undefined && typeof p.configurable !== 'boolean') throw new TypeError('Invalid position capability')
        if (p.note && (!Array.isArray(p.note) || p.note.length !== 2 || p.note.some(n => typeof n !== 'string'))) throw new TypeError('Invalid position note')
        if (p.anchor && (typeof p.anchor.sourceId !== 'string' || !idPattern.test(p.anchor.sourceId) || !['before', 'after'].includes(p.anchor.side) || (p.anchor.fields && (!Array.isArray(p.anchor.fields) || p.anchor.fields.some(f => typeof f !== 'string'))))) throw new TypeError('Invalid resource anchor')
        if (p.macros && (!Array.isArray(p.macros) || p.macros.some(m => typeof m !== 'string'))) throw new TypeError('Invalid position macros')
      }
    }
    if (!Array.isArray(descriptor.dependencies) || descriptor.dependencies.some(id => !idPattern.test(id)) || !['asset', 'conversation', 'evaluation', 'assembly', 'snapshot'].includes(descriptor.stability)) throw new TypeError('Invalid source descriptor')
    if (!Number.isInteger(descriptor.version) || descriptor.version < 1 || !Array.isArray(descriptor.roles) || !descriptor.roles.length || descriptor.roles.some(r => !['preserve', 'system', 'user', 'assistant'].includes(r)) || !Array.isArray(descriptor.lifetimes) || !descriptor.lifetimes.length || descriptor.lifetimes.some(l => !['request', 'snapshot'].includes(l))) throw new TypeError('Invalid source capabilities')
    if (source.validateResolved !== undefined && typeof source.validateResolved !== 'function') throw new TypeError('validateResolved must be a function')
    if (source.textParserAliasFor !== undefined && (typeof source.textParserAliasFor !== 'string' || !idPattern.test(source.textParserAliasFor) || source.textParserAliasFor === source.id)) throw new TypeError('Invalid parser alias')
    if (source.contentGuide !== undefined && ['contains', 'origin', 'editable', 'editAt'].some(key => !Array.isArray(source.contentGuide[key]) || source.contentGuide[key].length !== 2 || source.contentGuide[key].some(text => typeof text !== 'string' || !text))) throw new TypeError('Content guide requires bilingual contains, origin, editable and editAt')
    if (source.parseText !== undefined && typeof source.parseText !== 'function') throw new TypeError('parseText must be a function')
    if (source.renderText !== undefined && typeof source.renderText !== 'function') throw new TypeError('renderText must be a function')
    if (source.supportsModule !== undefined && typeof source.supportsModule !== 'boolean') throw new TypeError('supportsModule must be a boolean')
    if (source.moduleAvailable !== undefined && typeof source.moduleAvailable !== 'function') throw new TypeError('moduleAvailable must be a synchronous metadata reader')
    const entry = { descriptor, moduleAvailable: source.moduleAvailable, resolve: source.resolve, parseText: source.parseText, renderText: source.renderText ?? this.renderText, validateResolved: source.validateResolved }
    this.#sources.set(source.id, entry)
    return () => { if (this.#sources.get(source.id) === entry) this.#sources.delete(source.id) }
  }
  list(context = {}) {
    const scope = freeze(structuredClone(context))
    return structuredClone([...this.#sources.values()].map(s => {
      const available = s.descriptor.supportsModule && (s.moduleAvailable ? s.moduleAvailable(scope) : true)
      if (typeof available !== 'boolean') { available?.catch?.(() => {}); throw new TypeError('moduleAvailable must return a boolean synchronously') }
      return { ...s.descriptor, moduleAvailable: available }
    }))
  }
  #jobs(context) {
    // Capture registrations and a detached read-only request once: unload/reload only
    // changes the next request, never half of an in-flight resolution.
    const sources = new Map(this.#sources), jobs = [], visiting = new Set(), done = new Set(), diagnostics = []
    const visit = rule => {
      if (done.has(rule.id)) return
      if (visiting.has(rule.kind)) throw new TypeError(`Cyclic source dependencies: ${rule.kind}`)
      const source = sources.get(rule.kind)
      if (!source) { diagnostics.push({ code: 'ASSEMBLY_SOURCE_UNAVAILABLE', sourceId: rule.kind, ruleId: rule.id }); done.add(rule.id); return }
      const d = source.descriptor
      if (rule.inputMode === 'text' && !source.parseText) throw new TypeError(`Source does not accept custom text: ${rule.kind}`)
      if (rule.inputMode !== 'text' && !source.resolve) throw new TypeError(`Source only supplies a text parser: ${rule.kind}`)
      if (!d.roles.includes(rule.role) || !d.lifetimes.includes(rule.lifetime) || (!d.depth && rule.depth != null)) throw new TypeError(`Unsupported rule settings for ${rule.kind}`)
      if (!d.multiple && rule.inputMode !== 'text' && context.preset.rules.filter(r => r.kind === rule.kind && r.inputMode !== 'text').length > 1) throw new TypeError(`Duplicate source rule: ${rule.kind}`)
      visiting.add(rule.kind)
      for (const id of d.dependencies) visit(context.preset.rules.find(r => r.kind === id && r.inputMode !== 'text') ?? { id: `reference-${id}`, kind: id, enabled: false, role: 'preserve', lifetime: 'request', depth: null, text: '', name: '' })
      visiting.delete(rule.kind); done.add(rule.id); jobs.push({ rule, ...source })
    }
    for (const rule of context.preset.rules.filter(r => r.enabled)) visit(rule)
    const { signal, ...data } = context
    return { jobs, catalog: [...sources.values()].map(s => s.descriptor), context: Object.freeze({ ...freeze(structuredClone(data)), signal }), diagnostics }
  }
  #result(job, output) {
    if (!output || !Array.isArray(output.blocks) || output.blocks.length > 10000) throw new TypeError(`Invalid blocks from ${job.descriptor.id}`)
    // Functions, undefined fields and non-JSON state are not a wire contract.
    const json = JSON.stringify(output)
    if (Buffer.byteLength(json) > 8 * 1024 * 1024) throw new TypeError(`Source output exceeds 8 MiB: ${job.descriptor.id}`)
    const result = JSON.parse(json), ids = new Set()
    for (const block of result.blocks) {
      if (!block || typeof block.id !== 'string' || !block.id || ids.has(block.id) || !['text', 'native', 'reference'].includes(block.type)) throw new TypeError(`Invalid/duplicate block from ${job.descriptor.id}`)
      ids.add(block.id)
      if (block.type === 'text' && typeof block.text !== 'string') throw new TypeError('Text block requires text')
      if (block.type === 'native' && (!Array.isArray(block.messageIds) || block.messageIds.some(id => typeof id !== 'string'))) throw new TypeError('Native block requires messageIds')
      if (block.type === 'reference' && (!idPattern.test(block.sourceId) || (block.blockIds !== undefined && (!Array.isArray(block.blockIds) || block.blockIds.some(id => typeof id !== 'string'))))) throw new TypeError('Invalid source reference')
      if (block.depth != null && (!Number.isInteger(block.depth) || block.depth < 0 || block.depth > 10000)) throw new TypeError('Invalid block depth')
      if (block.role !== undefined && !['system', 'user', 'assistant'].includes(block.role)) throw new TypeError('Invalid block role')
    }
    for (const block of result.blocks) {
      const references = [block.type === 'reference' ? block.sourceId : null, block.targetSourceId, ...(block.claims ?? []).map(c => c.sourceId)].filter(Boolean)
      if (references.some(id => id !== job.descriptor.id && !job.descriptor.dependencies.includes(id))) throw new TypeError(`Undeclared source dependency from ${job.descriptor.id}`)
    }
    return Object.freeze({ ...freeze(result), rule: job.rule, descriptor: job.descriptor, renderText: job.renderText })
  }
  #validateResolved(request) {
    for (const job of request.jobs) {
      const value = job.validateResolved?.(request.context)
      if (value?.then) { value.catch?.(() => {}); throw new TypeError('validateResolved must be synchronous') }
    }
  }
  resolveSync(context) {
    const request = this.#jobs(context), resolved = []
    for (const job of request.jobs) {
      aborted(context.signal)
      const output = (job.rule.inputMode === 'text' ? job.parseText : job.resolve)(request.context, freeze(structuredClone(job.rule)))
      if (output?.then) { output.catch?.(() => {}); throw new TypeError('Async source requires assembleRequestAsync') }
      resolved.push(this.#result(job, output))
    }
    this.#validateResolved(request)
    return { catalog: request.catalog, context: request.context, resolved, diagnostics: request.diagnostics }
  }
  async resolve(context) {
    const request = this.#jobs(context), resolved = []
    for (const job of request.jobs) {
      aborted(context.signal)
      const output = await abortable((job.rule.inputMode === 'text' ? job.parseText : job.resolve)(request.context, freeze(structuredClone(job.rule))), context.signal)
      aborted(context.signal); resolved.push(this.#result(job, output))
    }
    this.#validateResolved(request)
    return { catalog: request.catalog, context: request.context, resolved, diagnostics: request.diagnostics }
  }
}
