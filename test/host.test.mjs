import { CoreRequestBackend } from '../src/core-backend.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createDshRegistry, RequestAssembler, AssemblyPresetStore, BUILTINS, textOf } from '../src/index.js'
import { registerNotes } from '../docs/examples/notes.js'
const root = process.env.DSH_ASSEMBLER_CORE_ROOT
// Official core; synthetic provider and temporary Session. No Tavern package imported.
test('standalone DSH Host assembles native and third-party user text, records requests, and survives source removal', { skip: !root }, async () => {
  const require = createRequire(join(resolve(root), 'package.json')), load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt'), llm = await load('@deepseek-ai/dsh-llm')
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'standalone-assembler-')), requests = [], errors = []
  try {
    await ctx.plugin(SystemPrompt, { personaPrefix: 'NATIVE' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    ctx.on('agent/error', event => errors.push(event.error))
    class Provider extends llm.LlmAdapter {
      async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history' } }
      async *stream(request) { requests.push(structuredClone(request.messages)); yield { type: 'block-start', index: 0, blockType: 'text' }; yield { type: 'text-delta', index: 0, text: 'ANSWER' }; yield { type: 'block-end', index: 0, block: { type: 'text', text: 'ANSWER' } }; yield { type: 'finish', reason: { kind: 'stop' } } }
    }
    ctx.llm.registerAdapter(['offline'], new Provider())
    const registry = createDshRegistry(), store = new AssemblyPresetStore(directory), stop = registerNotes(registry, { read: async () => [{ id: 'place', text: 'DOCK' }] })
    const runtime = new RequestAssembler({ ctx, store, registry, resources: { assembledFor: () => ({ assemblyInput: { nativeVariables: { provider: 'offline' } } }), compile: () => ({ assemblyInput: {} }) } })
    runtime.registerRequestBackend(new CoreRequestBackend(runtime))
    ctx.on('agent/assemble-request', (payload, next) => runtime.execute(payload, next))
    const agent = (await ctx.agents.create({ sessionId: 'native', agentOptions: { provider: 'offline', model: 'offline' } })).agent
    const strategy = store.save({ ...BUILTINS[0], backend: 'core', rules: [...BUILTINS[0].rules, { id: 'native-text', kind: 'dsh.text', inputMode: 'text', text: 'DSH {{provider}}' }, { id: 'notes', kind: 'example.notes', role: 'user', inputMode: 'text', text: 'Location [[place]]' }] })
    store.apply(agent.id, strategy.id)
    for (const value of ['ONE', 'TWO']) { agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: value }], source: { kind: 'user' } })); await agent.whenIdle() }
    assert.deepEqual(errors, []); assert.equal(requests.length, 2)
    for (const messages of requests) { assert.ok(messages.some(m => textOf(m) === 'DSH offline')); assert.ok(messages.some(m => textOf(m) === 'Location DOCK')) }
    const recorded = agent.session.snapshotEvents().findLast(e => e.type === 'request/assembly')
    assert.equal(recorded.data.metadata.owner, 'dsh-prompt-assembler'); assert.deepEqual(recorded.data.messages, requests.at(-1))
    assert.ok(!agent.session.deriveMessages().some(m => textOf(m).includes('DOCK')))
    stop(); agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: 'THREE' }], source: { kind: 'user' } })); await agent.whenIdle()
    assert.deepEqual(errors, []); assert.ok(!requests.at(-1).some(m => textOf(m).includes('DOCK')))
    assert.ok(requests.at(-1).some(m => textOf(m) === 'THREE'))
  } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})

const managerRoot = process.env.DSH_ASSEMBLER_MANAGER_ROOT
test('standalone assembler connects Manager retrieval and applied evidence without Tavern', { skip: !root || !managerRoot }, async () => {
  const require = createRequire(join(resolve(root), 'package.json')), load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt'), llm = await load('@deepseek-ai/dsh-llm')
  const managerPlugin = await import(pathToFileURL(join(resolve(managerRoot), 'src/index.js')).href)
  const { connectMemoryManager } = await import('../adapters/memory-manager.js')
  const { writeFileSync } = await import('node:fs')
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'assembler-manager-')), requests = [], errors = []
  try {
    await ctx.plugin(SystemPrompt, { personaPrefix: 'NATIVE' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    ctx.on('agent/error', event => errors.push(event.error))
    class Provider extends llm.LlmAdapter {
      async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history' } }
      async *stream(request) { requests.push(structuredClone(request.messages)); yield { type: 'block-start', index: 0, blockType: 'text' }; yield { type: 'text-delta', index: 0, text: 'ANSWER' }; yield { type: 'block-end', index: 0, block: { type: 'text', text: 'ANSWER' } }; yield { type: 'finish', reason: { kind: 'stop' } } }
    }
    ctx.llm.registerAdapter(['offline'], new Provider())
    const registry = createDshRegistry(), store = new AssemblyPresetStore(join(directory, 'assembly'))
    ctx.provide('dshPromptSources', registry); connectMemoryManager(ctx, registry)
    const runtime = new RequestAssembler({ ctx, store, registry, resources: { assembledFor: () => ({ assemblyInput: {} }), compile: () => ({ assemblyInput: {} }) } })
    runtime.registerRequestBackend(new CoreRequestBackend(runtime))
    ctx.on('agent/assemble-request', (payload, next) => runtime.execute(payload, next))
    const configPath = join(directory, 'config.json')
    writeFileSync(configPath, JSON.stringify({ schemaVersion: 1, revision: 1, entries: [{ id: 'example:resource', adapterId: 'example', type: 'text', whitelist: [{ global: true }], blacklist: [], retrieve: { on: 'before_model_request', rule: true, strategy: [{ operation: 'memory.read_content' }, { operation: 'memory.to_text' }] } }], presets: {} }))
    const plugin = ctx.plugin(managerPlugin, { storageDir: join(directory, 'manager'), configPath }); await plugin
    const manager = ctx.get('dshMemoryManager')
    manager.registerAdapter({ id: 'example', authority: 'example', list: async () => [], read: async () => ({ id: 'example:resource', type: 'text', content: 'MANAGER WITHOUT TAVERN', revision: 4 }) })
    assert.equal(ctx.get('tavernRequestSources'), undefined)
    const agent = (await ctx.agents.create({ sessionId: 'manager', agentOptions: { provider: 'offline', model: 'offline' } })).agent
    const strategy = store.save({ ...BUILTINS[0], backend: 'core', rules: [...BUILTINS[0].rules, { id: 'memory', kind: 'memory-manager.resources', role: 'system' }] }); store.apply(agent.id, strategy.id)
    const turn = async text => { agent.followup(llm.createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })); await agent.whenIdle(); assert.deepEqual(errors, []) }
    await turn('ONE')
    assert.ok(requests[0].some(m => textOf(m).includes('MANAGER WITHOUT TAVERN')))
    assert.equal(agent.session.snapshotEvents().findLast(e => e.type === 'request/assembly').data.metadata.owner, 'dsh-prompt-assembler')
    const applied = manager.traces.filter(t => t.phase === 'applied'); assert.equal(applied.length, 1); assert.equal(applied[0].revision, 4)
    await plugin.dispose(); assert.ok(!registry.list().some(s => s.id === 'memory-manager.resources'))
    await turn('TWO'); assert.ok(!requests.at(-1).some(m => textOf(m).includes('MANAGER WITHOUT TAVERN')))
    assert.ok(agent.session.deriveMessages().some(m => textOf(m) === 'ONE'))
  } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
