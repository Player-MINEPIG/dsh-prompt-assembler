import { AssemblyPresetStore } from './store.js'
import { RequestAssembler } from './runtime.js'
import { createDshRegistry } from '../adapters/dsh.js'
import { BUILTINS } from './model.js'
import { createAssemblyApi } from './server.js'
import { connectMemoryManager } from '../adapters/memory-manager.js'
import { secureAssemblerApi } from './api-security.js'
import { connectHistoryPolicy } from './history/integration.js'
import { HISTORY_API_ROOT } from './history/server.js'
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
  runtime.validateResult = (...args) => provider?.validateResult?.(...args)
  const history = connectHistoryPolicy(ctx, { runtime, storageDir: config.storageDir })
  const face = {
    registry, store, runtime, history,
    migrateLegacy: root => store.migrateLegacy(root),
    attachTavern(options) {
      if (provider) throw new Error('Tavern source provider is already attached')
      if (!options?.resources?.compile || !options.resources.assembledFor) throw new TypeError('Tavern requires read-only resource compilation')
      provider = options
      const previous = { builtins: store.builtins, defaultPresetId: store.defaultPresetId }
      store.builtins = [...BUILTINS, ...(options.builtins ?? []).filter(p => !BUILTINS.some(b => b.id === p.id))]
      store.defaultPresetId = runtime.requestAssemblyAvailable() && options.coreDefaultPresetId ? options.coreDefaultPresetId : options.defaultPresetId ?? BUILTINS[0].id
      return () => { if (provider !== options) return; provider = null; Object.assign(store, previous) }
    },
  }
  ctx.provide('dshPromptSources', registry)
  ctx.provide('dshPromptAssembler', face)
  // Capture the complete result after all providers, without emitting events or
  // storing an extra history. This is the snapshot used by native DSH text.
  ctx.on('system-prompt/assemble', async (assembly, context, next) => {
    try {
      const result = await next()
      if (context.agent) nativeSnapshots.set(context.agent, { assemblyInput: {}, officialAssembly: structuredClone(result) })
      return await runtime.nativeAssembly(result, context)
    } finally {
      // Claimed inputs are needed only for this assembly, including failed or aborted attempts.
      if (context.agent && !context.dshAssemblerRaw && !context.tavernAssemblyPreview) runtime.claimed.delete(context.agent)
    }
  })
  ctx.on('agent/inbox/claimed', payload => runtime.claim(payload))
  ctx.on('agent/created', ({ agent }) => {
    const parent = agent.session?.header?.parentSession
    if (parent) store.copySelection(parent, agent.id)
  })
  ctx.on('agent/pre-step', (payload, next) => runtime.nativePreStep(payload, next))
  if (typeof ctx.inject === 'function') {
    connectMemoryManager(ctx, registry)
    ctx.inject(['webServer'], scope => {
      const assembly = createAssemblyApi({ store, runtime,
        agents: () => ctx.get('agents'), sessions: () => ctx.get('sessions'),
        inspect: id => ctx.get('sessionController').inspect(id), readActual: id => provider?.readActual?.(id), root: API_V1 })
      const handler = secureAssemblerApi((req, res) => {
        const path = new URL(req.url, 'http://localhost').pathname
        return (path === HISTORY_API_ROOT || path.startsWith(`${HISTORY_API_ROOT}/`) ? history.handler : assembly)(req, res)
      }, config.security)
      scope.effect(() => scope.webServer.register({ kind: 'prefix', path: API_ROOT, handler }), 'assembler: HTTP API')
    })
  }
  return face
}
export default { name, inject, apply }
