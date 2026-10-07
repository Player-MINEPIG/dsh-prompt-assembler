import { assembleRequestAsync } from './assemble.js'
import { createDshRegistry as createDefaultRegistry } from '../adapters/dsh.js'
import { normalizePreset } from './model.js'
import { projectSystemSnapshots } from './system-snapshots.js'

function previewAgent(ctx, agent) {
  if (!agent || agent.options !== undefined) return agent
  // A cold preview has a detached Session, not an Agent. Official prompt
  // variables still expect options; use the same read-only selection order
  // as SessionController without resuming or preparing a model request.
  const selected = ctx.get('sessionProjections')?.stateOf?.(agent.session, 'modelSelection')?.pending
    ?? agent.session?.requestHeader?.()?.config
    ?? ctx.get('agentDefaultModel')?.currentSelection?.()
  return { ...agent, options: selected ? { provider: selected.provider, model: selected.model } : {} }
}

import { assembleNative, presetBackend, validateNativePreset, observeNativePlan } from './native-backend.js'
export class RequestAssembler {
  constructor({ ctx, store, resources, registry = createDefaultRegistry(), sessionReads, owner = 'dsh-prompt-assembler', afterAssembly }) {
    Object.assign(this, { afterAssembly, owner, ctx, store, resources, registry, sessionReads })
    this.backend = null; this.nativePlans = new WeakMap(); this.claimed = new WeakMap()
  }
  sources(sessionId) { return this.registry.list({ sessionId }) }
  available() { return typeof this.ctx.get('systemPrompt')?.assemble === 'function' || this.backend?.available() === true }
  capabilities() {
    return { native: typeof this.ctx.get('systemPrompt')?.assemble === 'function', core: this.backend?.available() === true,
      coreExtensionInstalled: this.backend !== null, defaultBackend: 'native', nativeHistoryControl: false,
      nativeRoles: ['system', 'user'], nativeUserDelivery: ['context', 'pre-step'], nativeUserEntersHistory: true }
  }
  registerRequestBackend(backend) {
    if (this.backend) throw new Error('A core assembly backend is already installed')
    if (backend?.id !== 'core' || typeof backend.available !== 'function' || typeof backend.execute !== 'function') throw new TypeError('Invalid core assembly backend')
    this.backend = backend; this.ctx.emit?.('system-prompt/change')
    return () => { if (this.backend === backend) { this.backend = null; this.ctx.emit?.('system-prompt/change') } }
  }
  requireAvailable(preset) {
    if (preset && presetBackend(preset) === 'native') {
      if (!this.capabilities().native) throw Object.assign(new Error('Native system prompt assembly is unavailable'), { status: 409, code: 'ASSEMBLY_NATIVE_UNAVAILABLE' })
      validateNativePreset(preset); return
    }
    if (!this.backend?.available()) throw Object.assign(new Error('This strategy requires the optional dsh-prompt-assembler-core extension and the prepared DSH protocol-1 core.'), { status: 409, code: 'REQUEST_ASSEMBLY_CORE_REQUIRED' })
  }
  selected(id) { return this.store.selection(id) }
  requestAssemblyAvailable(id) {
    return this.backend?.available() === true && (id === undefined || presetBackend(this.selected(id)) === 'core')
  }
  startsSeries(agent) { return this.requestAssemblyAvailable(agent.id) ? this.backend.startsSeries?.(agent) ?? false : false }
  async execute(payload, next) {
    const preset = this.selected(payload.agent.id)
    if (!preset || presetBackend(preset) === 'native') return next()
    this.requireAvailable(preset)
    return this.backend.execute(payload, next)
  }
  claim({ agent, message }) { if (agent) this.claimed.set(agent, [...(this.claimed.get(agent) ?? []), message]) }
  async nativeAssembly(assembly, context) {
    if (context.dshAssemblerRaw || context.tavernAssemblyPreview || !context.agent) return assembly
    const preset = this.selected(context.agent.id)
    if (!preset) { this.nativePlans.delete(context.agent); return assembly }
    this.requireAvailable(preset)
    if (presetBackend(preset) !== 'native') { this.nativePlans.delete(context.agent); return assembly }
    const plan = await assembleNative(this, { preset, agent: context.agent, assembly, inputs: this.claimed.get(context.agent) ?? [], signal: context.signal })
    this.nativePlans.set(context.agent, plan)
    return plan.assembly
  }
  async nativePreStep(payload, next) {
    try {
      const decision = await next()
      if (decision?.kind === 'reject' || payload.signal?.aborted) return decision
      const plan = this.nativePlans.get(payload.agent)
      // A tool continuation is an actual stock step even with an empty inbox.
      const lastAssistant = payload.agent.session.deriveMessages().findLast(m => m.role === 'assistant')
      const continuesTools = payload.step > 1 && lastAssistant?.content.some(b => b.type === 'tool-call')
      if (!plan || (!decision.messages?.length && !continuesTools)) return decision // Do not manufacture a waking input.
      return { ...decision, messages: [...plan.beforeInput, ...decision.messages, ...plan.afterInput] }
    } finally { this.claimed.delete(payload.agent) }
  }
  observeNativeRequest(options, session) { return observeNativePlan(this.nativePlans.get(this.ctx.get('agents')?.get(options.sessionId)), options, session) }
  async preview({ preset, agent, sessionId, signal, nativeVariables }) {
    if (agent?.session && this.sessionReads) return this.sessionReads.run(agent.session, () => this.#preview({ preset, agent, sessionId, signal, previewVariables: nativeVariables }))
    return this.#preview({ preset, agent, sessionId, signal, previewVariables: nativeVariables })
  }
  async #preview({ preset, agent, sessionId, signal, previewVariables }) {
    agent = previewAgent(this.ctx, agent)
    const snapshot = this.resources.compile({ agent, sessionId, resolveOnly: true })
    // Historical system messages may still contain the old loader's assets.
    // Preview current core assembly independently, without committing any event.
    let nativeMessages = (agent?.session?.deriveMessages?.() ?? []).filter(m => m.role !== 'system')
    const diagnostics = [...(snapshot.diagnostics ?? [])]
    let officialSections = [], nativeVariables = {}
    const systemPrompt = this.ctx.get('systemPrompt')
    if (systemPrompt?.assemble) {
      const current = await systemPrompt.assemble({ agent, scope: agent, tavernAssemblyPreview: true, dshAssemblerRaw: true })
      // Trusted callers may supply pre-session model/workspace variables. This
      // input is deliberately absent from the HTTP session-preview endpoint.
      if (previewVariables) current.variables = { ...current.variables, ...previewVariables }
      officialSections = current.sections; nativeVariables = current.variables ?? {}
      const text = current.sections.map(section => section.interpolate === false ? section.text : section.text.replace(/\{\{([^{}]*)\}\}/g, (_, key) => {
        if (!/^[a-z][a-z0-9_]*$/.test(key) || typeof current.variables?.[key] !== 'string') throw Object.assign(new Error(`Native preview variable "${key}" is unavailable in the current session configuration`), { code: 'NATIVE_PREVIEW_VARIABLE_UNAVAILABLE', status: 409 })
        return current.variables[key]
      })).filter(Boolean).join('\n\n')
      if (text) nativeMessages.unshift({ id: 'preview-native-system', role: 'system', content: [{ type: 'text', text }], source: { kind: 'system-prompt' } })
    } else diagnostics.push({ code: 'NATIVE_SYSTEM_PREVIEW_UNAVAILABLE' })
    if (presetBackend(preset) === 'native') {
      const current = { sections: officialSections, variables: nativeVariables, contexts: [], tools: [] }
      const plan = await assembleNative(this, { preset, agent, sessionId, assembly: current, preview: true, signal })
      return { ...plan.logical, backend: 'native', capability: this.available(), supported: true, scope: 'current-resources-and-durable-history', pendingInputsIncluded: false, transport: { system: 'official-sections', user: 'durable-context-or-pre-step', priorContributionsRemainInHistory: true } }
    }
    const logical = await assembleRequestAsync({ registry: this.registry, afterAssembly: this.afterAssembly, sessionId: sessionId ?? agent?.id ?? '', signal, preset, assets: { ...snapshot.assemblyInput, diagnostics, officialSections, nativeVariables }, nativeMessages, preview: true, maxBytes: this.resources.maxProfileBytes })
    const assembly = projectSystemSnapshots(logical, nativeMessages, undefined, { preview: true })
    return { ...assembly, capability: this.available(), backend: 'core', supported: this.requestAssemblyAvailable(sessionId), scope: 'current-resources-and-durable-history', pendingInputsIncluded: false }
  }
}
