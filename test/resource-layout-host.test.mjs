import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import plugin from '../src/plugin.js'
import { AssemblyPresetStore } from '../src/store.js'
import { withBlockMove } from '../src/resource-layout.js'
import { registerTavernSources, DEFAULT_RULES } from '../adapters/tavern.js'
import { textOf } from '../src/assemble.js'
for (const backend of ['native', 'core']) {
  const root = process.env[backend === 'native' ? 'DSH_ASSEMBLER_STOCK_ROOT' : 'DSH_ASSEMBLER_CORE_ROOT']
  test(`real ${backend} Host executes persisted whole-group moves and new activation`, { skip: !root }, async () => {
    const require = createRequire(join(resolve(root), 'package.json')), load = name => import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)).href)
    const { Context } = await load('cordis'), { SystemPrompt } = await load('dsh-system-prompt'), llm = await load('dsh-llm')
    const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'layout-host-')), requests = [], errors = []
    try {
      await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false, personaPrefix: 'NATIVE' })
      for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
      ctx.provide('sessionController', {})
      ctx.on('agent/error', e => errors.push(e.error))
      class Offline extends llm.LlmAdapter {
        async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history' } }
        async *stream(request) { requests.push(structuredClone(request.messages)); yield { type: 'block-start', index: 0, blockType: 'text' }; yield { type: 'text-delta', index: 0, text: 'ANSWER' }; yield { type: 'block-end', index: 0, block: { type: 'text', text: 'ANSWER' } }; yield { type: 'finish', reason: { kind: 'stop' } } }
      }
      ctx.llm.registerAdapter(['offline'], new Offline())
      await ctx.plugin(plugin, { storageDir: directory })
      const face = ctx.get('dshPromptAssembler')
      if (backend === 'core') await ctx.plugin((await import('../core-extension/src/plugin.js')).default)
      registerTavernSources(face.registry)
      const assets = { preset: { id: 'p', prompts: [{ identifier: 'before', marker: false, enabled: true, role: 'system', content: '{{worldInfoBefore}}' }] }, character: { id: 'c', data: { description: 'CHARACTER' } }, loreEntries: [{ id: 'bound', resourceId: 'w', content: 'BOUND', position: 'before' }, { id: 'one', resourceId: 'w', content: 'ONE', position: 'after' }, { id: 'two', resourceId: 'w', content: 'TWO', position: 'after' }] }
      face.attachTavern({ resources: { compile: () => ({ assemblyInput: assets }), assembledFor: () => ({ assemblyInput: assets }) } })
      const initial = face.store.save({ format: 'dsh-tavern-request-assembly', version: 1, name: 'Layout', backend, rules: DEFAULT_RULES, layout: { version: 1, source: 'preset-slots', identity: 'preserve', fallback: 'source-order', overrides: [] } })
      const agent = (await ctx.agents.create({ sessionId: 'fixture', agentOptions: { provider: 'offline', model: 'offline' } })).agent
      const preview = await face.runtime.preview({ preset: initial, agent, sessionId: 'fixture' })
      const block = text => preview.resourceLayout.blocks.find(b => b.entries.some(e => e.text === text))
      const saved = face.store.save(withBlockMove(initial, preview.resourceLayout, block('ONE').id, block('CHARACTER').id), initial.id)
      face.store.apply('fixture', saved.id)
      assert.deepEqual(new AssemblyPresetStore(directory, { unified: true }).selection('fixture').layout, saved.layout)
      assets.loreEntries.push({ id: 'new', resourceId: 'w', content: 'NEW', position: 'after' })
      agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: 'INPUT' }], source: { kind: 'user' } })); await agent.whenIdle()
      assert.deepEqual(errors, []); assert.equal(requests.length, 1)
      const text = requests[0].map(textOf).join('\n\n')
      assert.ok(text.indexOf('BOUND') < text.indexOf('ONE'))
      assert.ok(text.includes('ONE\n\nTWO\n\nNEW\n\nCHARACTER'))
      const after = await face.runtime.preview({ preset: saved, agent, sessionId: 'fixture' })
      assert.deepEqual(after.resourceLayout.blocks.find(b => b.id === block('ONE').id).entries.map(e => e.text), ['ONE', 'TWO', 'NEW'])
    } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
  })
}
