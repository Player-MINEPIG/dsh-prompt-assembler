import { AssemblyPresetStore } from './store.js'
import { RequestAssembler } from './runtime.js'
import { createDshRegistry } from '../adapters/dsh.js'
import { BUILTINS } from './model.js'
import { createAssemblyApi } from './server.js'
import { connectMemoryManager } from '../adapters/memory-manager.js'
import { secureAssemblerApi } from './api-security.js'
import { API_ROOT, API_V1, PLUGIN_ID } from './identity.js'

export const name = PLUGIN_ID
export const inject = ['systemPrompt', 'sessionController']
export function apply(ctx, config = {}) {
  if (!config.storageDir) throw new TypeError('Assembler storageDir is required')
  if (ctx.get('dshPromptAssembler')) throw new Error('Only one prompt assembler plugin may be mounted')
  let provider = null
  const nativeSnapshots = new WeakMap()
  const registry = createDshRegistry()
  const store = new AssemblyPresetStore(config.storageDir, { mode: () => provider?.mode?.() ?? null, unified: true })
  const native = { compile: () => ({ assemblyInput: {} }), assembledFor: agent => nativeSnapshots.get(agent) ?? { assemblyInput: {} } }
  const resources = {
    compile: context => (provider?.resources ?? native).compile(context),
    assembledFor: agent => (provider?.resources ?? native).assembledFor(agent),
    get maxProfileBytes() { return provider?.resources?.maxProfileBytes },
  }
  const sessionReads = { run: (session, fn) => provider?.sessionReads ? provider.sessionReads.run(session, fn) : fn() }
  const runtime = new RequestAssembler({ ctx, store, registry, resources, sessionReads,
    afterAssembly: (...args) => provider?.afterAssembly?.(...args) })
  const face = {
    registry, store, runtime,
    migrateLegacy: root => store.migrateLegacy(root),
    attachTavern(options) {
      if (provider) throw new Error('Tavern source provider is already attached')
      if (!options?.resources?.compile || !options.resources.assembledFor) throw new TypeError('Tavern requires read-only resource compilation')
      provider = options
      const previous = { builtins: store.builtins, defaultPresetId: store.defaultPresetId }
      store.builtins = [...BUILTINS, ...(options.builtins ?? []).filter(p => !BUILTINS.some(b => b.id === p.id))]
      store.defaultPresetId = options.defaultPresetId ?? BUILTINS[0].id
      return () => { if (provider !== options) return; provider = null; Object.assign(store, previous) }
    },
  }
  ctx.provide('dshPromptSources', registry)
  ctx.provide('dshPromptAssembler', face)
  // Capture the complete result after all providers, without emitting events or
  // storing an extra history. This is the snapshot used by native DSH text.
  ctx.on('system-prompt/assemble', async (assembly, context, next) => {
    const result = await next()
    if (context.agent) nativeSnapshots.set(context.agent, { assemblyInput: {}, officialAssembly: structuredClone(result) })
    return result
  })
  ctx.on('agent/assemble-request', async (payload, next) => {
    const result = await runtime.execute(payload, next)
    provider?.validateResult?.(result, payload.agent)
    return result
  })
  ctx.on('agent/created', ({ agent }) => {
    const parent = agent.session?.header?.parentSession
    if (parent) store.copySelection(parent, agent.id)
  })
  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (decision?.kind === 'reject' || payload.signal?.aborted) return decision
    return runtime.available() && runtime.startsSeries(payload.agent) ? { ...decision, startsRequestSeries: true } : decision
  })
  if (typeof ctx.inject === 'function') {
    connectMemoryManager(ctx, registry)
    ctx.inject(['webServer'], scope => {
      const handler = secureAssemblerApi(createAssemblyApi({ store, runtime,
        agents: () => ctx.get('agents'), sessions: () => ctx.get('sessions'),
        inspect: id => ctx.get('sessionController').inspect(id), root: API_V1 }), config.security)
      scope.effect(() => scope.webServer.register({ kind: 'prefix', path: API_ROOT, handler }), 'assembler: HTTP API')
    })
  }
  return face
}
export default { name, inject, apply }
