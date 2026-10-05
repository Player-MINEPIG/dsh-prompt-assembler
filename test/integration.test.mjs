import test from 'node:test'
import assert from 'node:assert/strict'
import { createDshRegistry, RequestSourceRegistry, assembleRequest, assembleRequestAsync, BUILTINS, textOf, FORMAT, RequestAssembler } from '../src/index.js'
import { registerNotes } from '../docs/examples/notes.js'
import { createDefaultRegistry, BUILTINS as TAVERN } from '../adapters/tavern.js'
const m = (id, role = 'user', text = id) => ({ id, role, content: [{ type: 'text', text }], source: { kind: role === 'user' ? 'user' : 'system-prompt' } })
const native = [m('s', 'system'), m('u1'), m('a1', 'assistant'), m('u2')]
const preset = rules => ({ format: FORMAT, version: 1, name: 'Example', rules })
const texts = result => result.messages.map(textOf)

test('documented third-party source and custom parser use the same placement/lifetime controls', async () => {
  const registry = createDshRegistry(), calls = []
  const stop = registerNotes(registry, { read: async input => { calls.push(input); return [{ id: 'place', text: 'DOCK' }] } })
  const rules = [...BUILTINS[0].rules, { id: 'notes', kind: 'example.notes', role: 'user', depth: 1 }]
  const result = await assembleRequestAsync({ registry, preset: preset(rules), sessionId: 'session', nativeMessages: native, inputIds: ['u2'] })
  assert.deepEqual(texts(result), ['s', 'u1', 'a1', 'DOCK', 'u2'])
  assert.equal(result.nodes.find(n => n.ruleId === 'notes').source.plugin, 'example.notes')
  rules.at(-1).inputMode = 'text'; rules.at(-1).text = 'Location: [[place]]; {{char}} stays literal'
  const custom = await assembleRequestAsync({ registry, preset: preset(rules), sessionId: 'session', nativeMessages: native, inputIds: ['u2'] })
  assert.equal(texts(custom)[3], 'Location: DOCK; {{char}} stays literal')
  assert.equal(custom.messages[3].role, 'user')
  assert.equal(calls.length, 2); assert.ok(calls.every(c => c.sessionId === 'session'))
  rules.at(-1).enabled = false
  assert.deepEqual(texts(await assembleRequestAsync({ registry, preset: preset(rules), nativeMessages: native })), ['s', 'u1', 'a1', 'u2'])
  assert.equal(calls.length, 2)
  rules.at(-1).enabled = true; stop()
  const removed = await assembleRequestAsync({ registry, preset: preset(rules), nativeMessages: native })
  assert.ok(removed.diagnostics.some(d => d.code === 'ASSEMBLY_SOURCE_UNAVAILABLE'))
  assert.deepEqual(texts(removed), ['s', 'u1', 'a1', 'u2'])
})
test('source custom parser failure/absence is explicit; no automatic execution or hidden fallback', async () => {
  const registry = createDshRegistry()
  registerNotes(registry, { read: async () => [] })
  await assert.rejects(assembleRequestAsync({ registry, preset: preset([{ id: 'c', kind: 'example.notes', inputMode: 'text', text: '[[missing]]' }]) }), /Unknown note/)
  registry.register({ id: 'example.no-text', pluginId: 'example', name: 'No text', resolve: () => ({ blocks: [] }) })
  await assert.rejects(assembleRequestAsync({ registry, preset: preset([{ id: 'c', kind: 'example.no-text', inputMode: 'text' }]) }), /does not accept custom text/)
  assert.ok(!registry.list().find(s => s.id === 'example.no-text').acceptsText)
})
test('DSH custom additions interpolate native variables without Tavern or a Skill execution hook', () => {
  const registry = createDshRegistry()
  assert.ok(registry.list().every(s => s.pluginId === 'DSH'))
  const p = preset([...BUILTINS[0].rules, { id: 'custom', kind: 'dsh.text', text: 'Provider {{provider}}; model {{model}}', inputMode: 'text' }])
  assert.equal(texts(assembleRequest({ registry, preset: p, nativeMessages: native, assets: { nativeVariables: { provider: 'offline', model: 'test' } } })).at(-1), 'Provider offline; model test')
  assert.throws(() => assembleRequest({ registry, preset: p }), /unavailable/)
  assert.deepEqual(texts(assembleRequest({ preset: BUILTINS[0], nativeMessages: native })), ['s', 'u1', 'a1', 'u2'])
})
test('Tavern custom entries and preset text share reference parsing while listed modules own placement', () => {
  const registry = createDefaultRegistry()
  assert.equal(registry.list().find(s => s.id === 'preset').acceptsText, true)
  assert.equal(registry.list().find(s => s.id === 'character').acceptsText, false)
  const p = preset([{ id: 's', kind: 'native-system' }, { id: 'c', kind: 'preset', inputMode: 'text', text: 'X{{history}}Y{{input}}Z', role: 'user' }])
  assert.deepEqual(texts(assembleRequest({ registry, preset: p, nativeMessages: native, inputIds: ['u2'] })), ['s', 'X', 'u1', 'a1', 'Y', 'u2', 'Z'])
  p.rules.push({ id: 'h', kind: 'history' }, { id: 'i', kind: 'input' })
  assert.deepEqual(texts(assembleRequest({ registry, preset: p, nativeMessages: native, inputIds: ['u2'] })), ['s', 'X', 'Y', 'Z', 'u1', 'a1', 'u2'])
})
test('cross-source references require declared dependencies; returned identity cannot spoof provenance', () => {
  const registry = new RequestSourceRegistry()
  registry.register({ id: 'target', pluginId: 'target', name: 'Target', resolve: () => ({ blocks: [{ id: 't', type: 'text', text: 'T' }] }) })
  registry.register({ id: 'bad', pluginId: 'bad', name: 'Bad', resolve: () => ({ blocks: [{ id: 'r', type: 'reference', sourceId: 'target' }], descriptor: { pluginId: 'DSH' } }) })
  assert.throws(() => assembleRequest({ registry, preset: preset([{ id: 'b', kind: 'bad' }]) }), /Undeclared/)
})
test('retained source content survives as history evidence but is excluded after unload', async () => {
  const registry = createDshRegistry(), stop = registerNotes(registry, { read: async () => [{ id: 'x', text: 'OLD' }] })
  const p = preset([...BUILTINS[0].rules, { id: 'n', kind: 'example.notes', lifetime: 'snapshot' }])
  const first = await assembleRequestAsync({ registry, preset: p, nativeMessages: native })
  assert.equal(first.snapshots.length, 1)
  stop()
  const next = await assembleRequestAsync({ registry, preset: p, nativeMessages: native, snapshots: first.snapshots })
  assert.equal(next.snapshots.length, 0); assert.equal(first.snapshots.length, 1)
})
test('async parse supports cancellation and captures one registration set during unload', async () => {
  const registry = createDshRegistry(), controller = new AbortController()
  let entered; const start = new Promise(resolve => { entered = resolve })
  const stop = registerNotes(registry, { read: async () => { entered(); return new Promise(() => {}) } })
  const p = preset([{ id: 'n', kind: 'example.notes', inputMode: 'text', text: '[[x]]' }])
  const pending = assembleRequestAsync({ registry, preset: p, signal: controller.signal })
  await start; stop(); controller.abort(new Error('cancel'))
  await assert.rejects(pending, /cancel/)
})
test('Tavern registry preserves third-party syntax unless that source opts into a renderer', () => {
  const registry = createDefaultRegistry()
  registry.register({ id: 'example.literal', pluginId: 'example', name: 'Literal', resolve: () => ({ blocks: [{ id: 'text', type: 'text', text: '{{char}} {{roll 1d6}}' }] }) })
  const result = assembleRequest({ registry, preset: preset([{ id: 'literal', kind: 'example.literal' }, { id: 'tavern', kind: 'custom', text: '{{char}}', role: 'user' }]), assets: { character: { name: 'CHARACTER' } } })
  assert.deepEqual(texts(result), ['{{char}} {{roll 1d6}}', 'CHARACTER'])
})
