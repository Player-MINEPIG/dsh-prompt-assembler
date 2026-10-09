import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import plugin from '../src/plugin.js'
import { BUILTINS } from '../src/model.js'
import { createAssemblyApi } from '../src/server.js'
import { textOf } from '../src/assemble.js'
import { registerNotes } from '../docs/examples/notes.js'
import { registerNotesLast } from '../docs/examples/notes-last.js'

for (const backend of ['native', 'core']) {
  const root = process.env[backend === 'native' ? 'DSH_ASSEMBLER_STOCK_ROOT' : 'DSH_ASSEMBLER_CORE_ROOT']
  test(`real ${backend} Host shares third-party strategies, catalog lifecycle and final request order`, { skip: !root }, async () => {
    const require = createRequire(join(resolve(root), 'package.json')), load = name => import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)).href)
    const { Context } = await load('cordis'), { SystemPrompt } = await load('dsh-system-prompt'), llm = await load('dsh-llm')
    const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'strategy-host-')), requests = [], errors = []
    try {
      await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false, personaPrefix: 'NATIVE' })
      for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
      ctx.provide('sessionController', { inspect: id => ({ events: ctx.sessions.get(id).snapshotEvents() }) })
      ctx.on('agent/error', e => errors.push(e.error))
      class Offline extends llm.LlmAdapter {
        async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history' } }
        async *stream(request) { requests.push(structuredClone(request.messages)); yield { type: 'block-start', index: 0, blockType: 'text' }; yield { type: 'text-delta', index: 0, text: 'ANSWER' }; yield { type: 'block-end', index: 0, block: { type: 'text', text: 'ANSWER' } }; yield { type: 'finish', reason: { kind: 'stop' } } }
      }
      ctx.llm.registerAdapter(['offline'], new Offline())
      await ctx.plugin(plugin, { storageDir: directory })
      const face = ctx.get('dshPromptAssembler')
      if (backend === 'core') await ctx.plugin((await import('../core-extension/src/plugin.js')).default)
      assert.equal(ctx.get('dshPromptStrategies'), face.registry.strategies)
      assert.equal(face.strategies, face.registry.strategies)
      const removeSource = registerNotes(face.registry, { read: async () => [{ id: 'scene', text: 'NOTES' }] })
      const removeStrategy = registerNotesLast(face.strategies)
      const removePresets = face.registerPresets({ pluginId: 'example.notes', presets: [{ ...BUILTINS[0], id: 'example-notes', name: 'Notes last', backend,
        layout: { version: 1, source: 'preset-slots', identity: 'position', fallback: 'source-order', overrides: [], priority: ['example.notes-last', 'preset', 'resource', 'default'] },
        rules: [{ id: 'notes', kind: 'example.notes', role: backend === 'core' ? 'user' : 'system', lifetime: 'request' }, ...BUILTINS[0].rules] }] })
      let response
      await createAssemblyApi({ store: face.store, runtime: face.runtime })({ method: 'GET', url: '/dsh-prompt-assembler/api/v1/assembly-presets' }, { setHeader() {}, end: s => { response = JSON.parse(s) } })
      assert.equal(response.strategyProtocolVersion, 1)
      assert.equal(response.strategies.find(s => s.id === 'example.notes-last').name[1], 'Notes last')
      const detachTavern = face.attachTavern({ resources: { compile: () => ({ assemblyInput: {} }), assembledFor: () => ({ assemblyInput: {} }) } })
      detachTavern(); assert.ok(face.store.get('example-notes').builtin)
      face.store.apply('fixture', 'example-notes')
      const agent = (await ctx.agents.create({ sessionId: 'fixture', agentOptions: { provider: 'offline', model: 'offline' } })).agent
      const preview = await face.runtime.preview({ preset: face.store.get('example-notes'), agent, sessionId: 'fixture' })
      assert.equal(preview.messages.at(-1).content[0].text, 'NOTES')
      agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: 'INPUT' }], source: { kind: 'user' } })); await agent.whenIdle()
      assert.deepEqual(errors, []); assert.equal(requests.length, 1); assert.equal(textOf(requests[0].at(-1)), 'NOTES')
      if (backend === 'core') {
        const record = agent.session.snapshotEvents().findLast(e => e.type === 'request/assembly').data
        assert.deepEqual(record.messages, requests[0])
        assert.ok(record.metadata.assembly.resourceLayout.strategies.some(s => s.id === 'example.notes-last'))
      }
      removePresets(); assert.equal(face.store.selection('fixture').id, 'example-notes')
      assert.throws(() => face.store.get('example-notes'), { status: 404 })
      removeStrategy()
      assert.throws(() => face.runtime.requireAvailable(face.store.selection('fixture')), { code: 'POSITION_STRATEGY_UNAVAILABLE' })
      await assert.rejects(face.runtime.preview({ preset: face.store.selection('fixture'), agent, sessionId: 'fixture' }), { code: 'POSITION_STRATEGY_UNAVAILABLE' })
      removeSource()
    } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
  })
}
