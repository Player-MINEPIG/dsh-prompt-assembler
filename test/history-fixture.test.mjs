// Reusable real-module Host fixture, also used by the isolated browser acceptance server.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { RequestAssembler, AssemblyPresetStore, createDshRegistry, BUILTINS } from '../src/index.js'
import { CoreRequestBackend } from '../src/core-backend.js'
import { HistoryPolicyStore, registerHistoryPolicy, createHistoryPolicyService, registerStandardHistoryPolicy } from '../src/history-policy.js'

export async function historyHost({ root, directory, seed, withTools = false, retryOnce = false, onRetry = () => {}, advanced = true, standard = false, standardActive }) {
  const require = createRequire(join(resolve(root), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)))
  const { Context } = await load('cordis'), { SystemPrompt } = await load('dsh-system-prompt'), llm = await load('dsh-llm')
  const ctx = new Context(), requests = [], errors = []
  await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false, personaPrefix: 'HISTORY FIXTURE' })
  for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
  ctx.on('agent/error', event => errors.push(event.error))
  const body = 'The door opens.\n<UpdateVariable>\n<Analysis>fixture only</Analysis>\n<JSONPatch>[]</JSONPatch>\n</UpdateVariable>\nYou enter.'
  let toolSent = false, retried = false
  if (retryOnce) ctx.on('agent/request-error', (_, next) => { if (!retried) { retried = true; onRetry(); return { kind: 'retry' } } return next() })
  class Provider extends llm.LlmAdapter {
    async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history' } }
    async *stream(request) {
      requests.push(structuredClone(request.messages))
      if (retryOnce && requests.length === 1) throw new Error('Synthetic retry fixture')
      const blocks = [{ type: 'reasoning', text: 'SYNTHETIC THOUGHT' }, { type: 'text', text: body }]
      if (withTools && !toolSent) { blocks.push({ type: 'tool-call', id: 'fixture-call', name: 'history_fixture', arguments: '{}' }); toolSent = true }
      for (const [index, block] of blocks.entries()) {
        yield { type: 'block-start', index, blockType: block.type }
        if (block.text) yield { type: `${block.type}-delta`, index, text: block.text }
        yield { type: 'block-end', index, block }
      }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
  ctx.llm.registerAdapter(['offline'], new Provider())
  if (withTools) {
    const { defineTool } = await load('dsh-tools')
    ctx.tools.register(defineTool({ name: 'history_fixture', description: 'Offline fixture tool', parameters: {}, output: { schema: { type: 'string' }, render: (_, value) => [{ type: 'text', text: value }] }, execute: async () => 'FIXTURE RESULT' }))
  }
  const assemblyStore = new AssemblyPresetStore(join(directory, 'assembly'))
  const runtime = new RequestAssembler({ ctx, store: assemblyStore, registry: createDshRegistry(), resources: { assembledFor: () => ({ assemblyInput: {} }), compile: () => ({ assemblyInput: {} }) } })
  if (advanced) runtime.registerRequestBackend(new CoreRequestBackend(runtime))
  const unmountAssembly = advanced ? ctx.on('agent/assemble-request', (payload, next) => runtime.execute(payload, next)) : () => {}
  const agent = (await ctx.agents.create({ sessionId: 'history', ...(seed ? { seed } : {}), agentOptions: { provider: 'offline', model: 'offline' } })).agent
  const preset = assemblyStore.save({ ...BUILTINS[0], backend: 'core', rules: [...BUILTINS[0].rules, { id: 'current', kind: 'dsh.text', inputMode: 'text', role: 'user', text: 'CURRENT PRESET' }] })
  if (advanced) assemblyStore.apply(agent.id, preset.id)
  const store = new HistoryPolicyStore(join(directory, 'history'))
  const reasoningSafety = () => ({ canOmit: true, contract: 'offline-synthetic-no-tools', toolsPresent: withTools })
  const stop = standard ? registerStandardHistoryPolicy(ctx, { store, readEvents: session => session.snapshotEvents(), createDeveloperMessage: llm.createDeveloperMessage, active: standardActive }) : advanced ? registerHistoryPolicy(ctx, { store, runtime, readEvents: session => session.snapshotEvents(), reasoningSafety }) : () => {}
  const readContext = async id => {
    const session = ctx.sessions.get(id)
    if (!session) throw Object.assign(new Error('Fixture session unavailable'), { status: 404 })
    return { nodes: [...session.surface.nodes], messages: session.deriveMessages(), events: session.snapshotEvents(), reasoningSafety: reasoningSafety() }
  }
  const service = createHistoryPolicyService({ store, readContext, reasoningSafety, mode: standard ? 'standard' : 'advanced' })
  const turn = async text => { agent.followup(llm.createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })); await agent.whenIdle(); assert.deepEqual(errors, []) }
  return { ctx, requests, errors, agent, llm, store, service, runtime, assemblyStore, stop, unmountAssembly, turn, body, dispose: () => ctx.fiber.dispose() }
}
