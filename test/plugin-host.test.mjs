import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import plugin from '../src/index.js'
import { AssemblyPresetStore, BUILTINS, textOf } from '../src/index.js'
import { registerNotes } from '../docs/examples/notes.js'

const root = process.env.DSH_ASSEMBLER_CORE_ROOT
// Mount the actual installable plugin, not a hand-composed runtime.
test('installable assembler owns first request, source removal and native history without Tavern', { skip: !root }, async () => {
  const require = createRequire(join(resolve(root), 'package.json')), load = name => import(pathToFileURL(require.resolve(name)).href)
  const { Context } = await load('@deepseek-ai/cordis'), { SystemPrompt } = await load('@deepseek-ai/dsh-system-prompt'), llm = await load('@deepseek-ai/dsh-llm')
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'assembler-plugin-')), requests = [], errors = []
  try {
    await ctx.plugin(SystemPrompt, { personaPrefix: 'NATIVE' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`@deepseek-ai/dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    ctx.provide('sessionController', { inspect: id => { const session = ctx.sessions.get(id); if (!session) throw Error('Missing session'); return { events: session.snapshotEvents() } } })
    ctx.on('agent/error', event => errors.push(event.error))
    class Provider extends llm.LlmAdapter {
      async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history' } }
      async *stream(request) { requests.push(structuredClone(request.messages)); yield { type: 'block-start', index: 0, blockType: 'text' }; yield { type: 'text-delta', index: 0, text: 'ANSWER' }; yield { type: 'block-end', index: 0, block: { type: 'text', text: 'ANSWER' } }; yield { type: 'finish', reason: { kind: 'stop' } } }
    }
    ctx.llm.registerAdapter(['offline'], new Provider())
    const handle = ctx.plugin(plugin, { storageDir: directory }); await handle
    const core = ctx.get('dshPromptAssembler')
    assert.ok(core); assert.equal(ctx.get('tavernRequestSources'), undefined)
    const stop = registerNotes(core.registry, { read: async () => [{ id: 'place', text: 'DOCK' }] })
    const strategy = core.store.save({ ...BUILTINS[0], rules: [...BUILTINS[0].rules, { id: 'native-text', kind: 'dsh.text', inputMode: 'text', text: 'DSH INSERT' }, { id: 'notes', kind: 'example.notes', role: 'user', inputMode: 'text', text: 'Location [[place]]' }] })
    // Apply before Agent creation / the first model request.
    core.store.apply('native', strategy.id)
    const agent = (await ctx.agents.create({ sessionId: 'native', agentOptions: { provider: 'offline', model: 'offline' } })).agent
    const turn = async text => { agent.followup(llm.createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })); await agent.whenIdle(); assert.deepEqual(errors, []) }
    await turn('ONE')
    assert.equal(requests.length, 1); assert.ok(requests[0].some(m => textOf(m) === 'DSH INSERT')); assert.ok(requests[0].some(m => textOf(m) === 'Location DOCK'))
    assert.equal(agent.session.snapshotEvents().findLast(e => e.type === 'request/assembly').data.metadata.owner, 'dsh-prompt-assembler')
    stop(); await turn('TWO'); assert.ok(!requests[1].some(m => textOf(m).includes('DOCK')))
    await handle.dispose(); await turn('THREE'); assert.ok(!requests[2].some(m => textOf(m) === 'DSH INSERT'))
    assert.ok(agent.session.deriveMessages().some(m => textOf(m) === 'ONE'))
    assert.ok(new AssemblyPresetStore(directory).selection('native'))
  } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})

test('legacy migration is additive, preserves original bytes and explicit disabled scopes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'assembler-migrate-'))
  try {
    const old = new AssemblyPresetStore(join(directory, 'old'), { mode: () => 'play' })
    const preset = old.save({ ...BUILTINS[0], name: 'Old' }); old.apply('one', preset.id); old.apply('disabled', null)
    const before = readFileSync(old.path), own = new AssemblyPresetStore(join(directory, 'own'))
    assert.equal(own.migrateLegacy(join(directory, 'old')), true); assert.deepEqual(readFileSync(old.path), before)
    assert.equal(own.selection('one').id, preset.id); assert.equal(own.selection('disabled'), null); assert.equal(own.hasSelection('disabled'), true)
    own.apply('one', null); assert.equal(own.migrateLegacy(join(directory, 'old')), false); assert.equal(own.selection('one'), null)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('independent apply supersedes legacy mode selection when Tavern is reattached', () => {
  const directory = mkdtempSync(join(tmpdir(), 'assembler-unified-'))
  try {
    const old = new AssemblyPresetStore(join(directory, 'old'), { mode: () => 'play' }); old.apply('one', null)
    let mode = null; const own = new AssemblyPresetStore(join(directory, 'own'), { unified: true, mode: () => mode }); own.migrateLegacy(join(directory, 'old'))
    assert.equal(own.selection('one'), null)
    own.apply('one', 'builtin-native'); mode = 'play'
    assert.equal(own.selection('one').id, 'builtin-native')
    mode = 'native'; assert.equal(own.selection('one').id, 'builtin-native')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
