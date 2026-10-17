import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import plugin, { BUILTINS, textOf } from '../src/index.js'
import { nativeVariables } from '../src/native-variables.js'
import { filterNativeContexts, contextControlPreview } from '../src/native-context.js'

const root = process.env.DSH_ASSEMBLER_STOCK_ROOT
const load = name => {
  const require = createRequire(join(resolve(root), 'package.json'))
  return import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)).href)
}

test('cwd compatibility uses the effective directory and preserves explicit variables', () => {
  const agent = { session: { header: { cwd: '/original' } } }
  const ctx = { get: () => ({ get: () => '/effective' }) }
  assert.deepEqual(nativeVariables(ctx, agent), { cwd: '/effective' })
  const explicit = { cwd: '/provided' }
  assert.equal(nativeVariables(ctx, agent, explicit), explicit)
  assert.deepEqual(nativeVariables({ get: () => undefined }, agent), { cwd: '/original' })
  assert.deepEqual(nativeVariables(ctx, undefined), {})
})

test('all-context control excludes optional official facts and retains required and foreign facts', () => {
  const contexts = ['working-directory:current', 'team:identity', 'harness:source', 'app:web-surface', 'sandbox:policy', 'foreign:fact'].map(name => ({ name, text: name }))
  const preset = { rules: [{ kind: 'dsh.runtime-context', enabled: false }] }
  assert.deepEqual(filterNativeContexts({ contexts }, preset).contexts.map(c => c.name), ['working-directory:current', 'team:identity', 'foreign:fact'])
  const preview = contextControlPreview({ contexts }, preset)
  assert.ok(preview.filter(c => c.required).every(c => c.enabled))
  assert.ok(preview.filter(c => !c.required).every(c => !c.enabled))
})

test('official admission accepts Standard on the target and rejects the frozen advanced addon', { skip: !root }, async () => {
  const { evaluatePluginCompatibility, getDshRuntimeVersion } = await load('dsh-app-boot')
  assert.equal(getDshRuntimeVersion(), '0.2.1-rc.2')
  for (const file of ['../package.json']) {
    const manifest = JSON.parse(readFileSync(new URL(file, import.meta.url)))
    assert.equal(evaluatePluginCompatibility(manifest), undefined)
    for (const version of ['0.2.0-rc.2', '0.2.1-rc.1', '0.2.1-rc.3']) {
      assert.deepEqual(evaluatePluginCompatibility(manifest, {}, version).requirements, { 'engines.dsh': '0.2.1-rc.2' })
    }
  }
  const frozen = JSON.parse(readFileSync(new URL('../core-extension/package.json', import.meta.url)))
  assert.equal(frozen.version, '1.1.0')
  assert.equal(frozen.peerDependencies['dsh-prompt-assembler'], '1.1.0')
  assert.deepEqual(evaluatePluginCompatibility(frozen).requirements, { 'engines.dsh': '0.2.0-rc.2' })
  assert.equal(evaluatePluginCompatibility(frozen, {}, '0.2.0-rc.2'), undefined)
})

test('stock Host preserves cwd text strategies, literal required facts, preview and unload', { skip: !root, timeout: 15000 }, async () => {
  const { Context } = await load('cordis'), { SystemPrompt } = await load('dsh-system-prompt'), llm = await load('dsh-llm')
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'assembler-021-')), requests = [], errors = []
  let cwd = '/first'
  try {
    await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    ctx.provide('sessionController', { inspect: id => ({ events: ctx.sessions.get(id).snapshotEvents() }) })
    ctx.provide('workingDirectory', { get: () => cwd })
    ctx.systemPrompt.context({ name: 'working-directory:current', order: 100, required: true, interpolate: false, text: () => `${cwd} {{literal}}` })
    ctx.systemPrompt.context({ name: 'harness:source', order: 200, text: 'OPTIONAL' })
    ctx.on('agent/error', e => errors.push(e.error))
    class Provider extends llm.LlmAdapter {
      async resolveModel(provider, id) { return { provider, id, name: id } }
      async *stream(request) {
        requests.push(structuredClone(request.messages))
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: 'ANSWER' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    ctx.llm.registerAdapter(['offline'], new Provider())
    const mounted = ctx.plugin(plugin, { storageDir: directory }); await mounted
    const face = ctx.get('dshPromptAssembler')
    const agent = (await ctx.agents.create({ sessionId: 'compat', agentOptions: { provider: 'offline', model: 'offline' } })).agent
    const preset = { ...BUILTINS[0], rules: [{ id: 'cwd', kind: 'dsh.text', text: 'Directory {{cwd}}', role: 'system' }, ...BUILTINS[0].rules, { id: 'contexts', kind: 'dsh.runtime-context', enabled: false }] }
    face.store.applySnapshot(agent.id, preset)
    for (const directory of ['/first', '/second']) {
      cwd = directory
      const preview = await face.runtime.preview({ preset, agent, sessionId: agent.id })
      assert.ok(preview.messages.some(m => textOf(m).includes(`Directory ${directory}`)))
      assert.equal(preview.runtimeContextControls.find(c => c.required).enabled, true)
      agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: 'INPUT' }], source: { kind: 'user' } }))
      await agent.whenIdle(); assert.deepEqual(errors, [])
      assert.ok(requests.at(-1).some(m => textOf(m).includes(`Directory ${directory}`)))
      const context = requests.at(-1).findLast(m => m.source?.kind === 'runtime-context')
      assert.match(textOf(context), /\{\{literal\}\}/)
      assert.doesNotMatch(textOf(context), /OPTIONAL/)
    }
    await mounted.dispose()
    const original = await ctx.systemPrompt.assemble({ agent, scope: agent })
    assert.equal(Object.hasOwn(original.variables, 'cwd'), false)
    assert.ok(original.contexts.some(c => c.name === 'harness:source'))
  } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
