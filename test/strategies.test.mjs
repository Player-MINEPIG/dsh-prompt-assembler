import test from 'node:test'
import assert from 'node:assert/strict'
import { PositionStrategyRegistry, createPositionStrategyRegistry } from '../src/strategies.js'
import { applyPositionStrategies, normalizePriority } from '../src/resource-positions.js'
import { RequestSourceRegistry } from '../src/registry.js'
import { assembleRequest, assembleRequestAsync } from '../src/assemble.js'
import { createDshRegistry } from '../adapters/dsh.js'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement as h } from 'react'
import { ResourcePositionEditor, PositionDecisions } from '../src/resource-layout-client.js'

const layout = { version: 1, source: 'preset-slots', identity: 'preserve', fallback: 'source-order', overrides: [], priority: ['vendor.tail', 'preset', 'resource', 'default'] }
const preset = { format: 'dsh-tavern-request-assembly', version: 1, name: 'Extension', backend: 'core', layout, rules: [{ id: 'data', kind: 'vendor.data' }] }
const nodes = () => [
  { id: 'a', text: 'A', source: { module: 'vendor.data' }, role: 'system', lifetime: 'request', positionId: 'content' },
  { id: 'b', text: 'B', source: { module: 'other' }, role: 'system', lifetime: 'request', positionId: 'content' },
  { id: 'history', source: { module: 'history' }, role: 'preserve', lifetime: 'native' },
]
const tail = { id: 'vendor.tail', pluginId: 'vendor', name: ['末尾', 'Tail'], execute: ({ nodes, remainingNodeIds }) => {
  const claimedNodeIds = nodes.filter(n => remainingNodeIds.includes(n.id) && n.source.module === 'vendor.data').map(n => n.id)
  return { claimedNodeIds, order: [...nodes.filter(n => !claimedNodeIds.includes(n.id)), ...nodes.filter(n => claimedNodeIds.includes(n.id))].map(n => n.id) }
} }

test('registry descriptors and callbacks survive identity-safe disposal only in captured requests', () => {
  const registry = new PositionStrategyRegistry(), remove = registry.register(tail), snapshot = registry.snapshot()
  assert.throws(() => registry.register(tail), /Duplicate/)
  const catalog = registry.list(); catalog[0].name[0] = 'mutated'
  assert.equal(registry.list()[0].name[0], '末尾')
  remove(); registry.register(tail); remove()
  assert.equal(registry.list().length, 1)
  assert.equal(snapshot.execute('vendor.tail', { nodes: nodes(), remainingNodeIds: ['a'] }).claimedNodeIds[0], 'a')
  assert.throws(() => registry.register({ ...tail, id: 'user' }), /requires/)
})
test('ordered strategies consume remaining nodes once; manual and native anchors cannot be claimed', () => {
  const registry = createPositionStrategyRegistry(), seen = []
  registry.register(tail)
  registry.register({ id: 'vendor.observe', pluginId: 'vendor', name: ['观察', 'Observe'], execute: c => { seen.push(c.remainingNodeIds); return { claimedNodeIds: [] } } })
  const ordered = nodes(), p = { ...preset, layout: { ...layout, priority: ['vendor.tail', 'vendor.observe', 'preset', 'resource', 'default'] } }
  const stages = applyPositionStrategies(ordered, p, [], false, registry.snapshot())
  assert.deepEqual(ordered.map(n => n.id), ['b', 'history', 'a'])
  assert.deepEqual(seen, [['b']]); assert.deepEqual(stages.find(s => s.strategy === 'vendor.tail').nodeIds, ['a'])
  assert.equal(ordered.at(-1).positionDecision, 'vendor.tail')
  p.layout.positions = [{ sourceId: 'vendor.data', positionId: 'content', enabled: true, placement: 'list' }]
  const manual = nodes(); applyPositionStrategies(manual, p, [], false, registry.snapshot())
  assert.equal(manual.find(n => n.id === 'a').positionDecision, 'user')
  assert.deepEqual(seen.at(-1), ['b'])
})
test('missing strategy retains persisted priority but fails explicitly even with fallback enabled', () => {
  assert.deepEqual(normalizePriority(layout.priority), layout.priority)
  assert.throws(() => applyPositionStrategies(nodes(), preset, []), { code: 'POSITION_STRATEGY_UNAVAILABLE', status: 409 })
  assert.throws(() => normalizePriority(['vendor.tail', 'preset', 'resource']), /Invalid/)
})
for (const [name, execute] of [
  ['claim a native anchor', () => ({ claimedNodeIds: ['history'] })],
  ['invent a node', () => ({ claimedNodeIds: ['a'], order: ['b', 'history', 'invented'] })],
  ['reorder unclaimed nodes', () => ({ claimedNodeIds: ['a'], order: ['history', 'b', 'a'] })],
  ['mutate node text', c => { c.nodes[0].text = 'Changed'; return { claimedNodeIds: [] } }],
  ['execute asynchronously', async () => ({ claimedNodeIds: [] })],
  ['return non-JSON diagnostics', () => ({ claimedNodeIds: ['a'], order: ['b', 'history', 'a'], diagnostics: [{ value: 1n }] })],
  ['return cyclic diagnostics', () => { const cycle = {}; cycle.self = cycle; return { claimedNodeIds: ['a'], diagnostics: [cycle] } }],
]) test(`invalid callback cannot ${name}`, () => {
  const registry = createPositionStrategyRegistry(); registry.register({ ...tail, execute })
  const input = nodes(), original = structuredClone(input)
  assert.throws(() => applyPositionStrategies(input, preset, [], false, registry.snapshot()))
  assert.deepEqual(input, original)
})
test('native role-preserving regions remain constrained', () => {
  const registry = createPositionStrategyRegistry(); registry.register(tail)
  assert.throws(() => applyPositionStrategies(nodes(), { ...preset, backend: 'native' }, [], false, registry.snapshot()), { code: 'POSITION_STRATEGY_INVALID' })
})
test('source and strategy registration snapshots cover an entire async assembly', async () => {
  const registry = new RequestSourceRegistry()
  let resume, entered
  const started = new Promise(r => { entered = r }), wait = new Promise(r => { resume = r })
  registry.register({ id: 'vendor.data', pluginId: 'vendor', name: 'Data', resolve: async () => { entered(); await wait; return { blocks: [{ id: 'body', type: 'text', text: 'BODY' }] } } })
  const dispose = registry.strategies.register(tail)
  const pending = assembleRequestAsync({ registry, preset })
  await started; dispose(); resume()
  const result = await pending
  assert.equal(result.nodes[0].positionDecision, 'vendor.tail')
  assert.equal(result.resourceLayout.strategies.find(s => s.id === 'vendor.tail').name[1], 'Tail')
  await assert.rejects(assembleRequestAsync({ registry, preset }), { code: 'POSITION_STRATEGY_UNAVAILABLE' })
})
test('custom ordering adapts standard native positions only when explicitly allowed', () => {
  const registry = createDshRegistry(); registry.strategies.register(tail)
  registry.register({ id: 'vendor.data', pluginId: 'vendor', name: 'Data', resolve: () => ({ blocks: [{ id: 'body', type: 'text', text: 'BODY' }] }) })
  const p = { ...preset, backend: 'native', layout: { ...layout, identity: 'position' }, rules: [{ id: 'data', kind: 'vendor.data' }, { id: 'history', kind: 'history' }, { id: 'input', kind: 'input' }] }
  const result = assembleRequest({ registry, preset: p, nativeMessages: [{ id: 'old', role: 'user', content: [{ type: 'text', text: 'OLD' }] }, { id: 'now', role: 'user', content: [{ type: 'text', text: 'NOW' }] }], inputIds: ['now'] })
  const body = result.nodes.find(n => n.text === 'BODY')
  assert.equal(body.role, 'user'); assert.equal(body.nativePlacement, 'after-input'); assert.equal(body.nativeDelivery, 'pre-step')
  assert.deepEqual(result.messages.map(m => m.id).slice(0, 2), ['old', 'now'])
})
test('editor and frozen decisions show third-party names and preserve unavailable IDs', () => {
  const strategies = createPositionStrategyRegistry(); strategies.register(tail)
  const props = { preset, sources: [], strategies: strategies.list(), sourceColor: () => '#888', originName: id => id, onChange() {} }
  const html = renderToStaticMarkup(h(ResourcePositionEditor, props))
  assert.match(html, /末尾/); assert.match(html, /data-priority="vendor.tail"/); assert.doesNotMatch(html, /undefined/)
  const missing = renderToStaticMarkup(h(ResourcePositionEditor, { ...props, strategies: [] }))
  assert.match(missing, /vendor.tail（未注册）/)
  const preview = { resourceLayout: { strategies: strategies.list(), priorityOrder: layout.priority, sortingStages: [{ strategy: 'vendor.tail', nodeIds: ['a'] }], positionDecisions: [{ sourceId: 'vendor.data', positionId: 'content', decision: 'vendor.tail' }] } }
  assert.match(renderToStaticMarkup(h(PositionDecisions, { preview, sources: [], strategies: [], locale: 1 })), /Tail/)
})

test('crossing a native boundary adapts every claimed node even when its absolute index is unchanged', () => {
  const registry = createDshRegistry()
  for (const [id, text] of [['vendor.a', 'A'], ['vendor.b', 'B'], ['vendor.body', 'BODY']]) registry.register({ id, pluginId: 'vendor', name: text, resolve: () => ({ blocks: [{ id: 'text', type: 'text', text }] }) })
  registry.strategies.register({ id: 'vendor.order', pluginId: 'vendor', name: ['顺序', 'Order'], execute: ({ nodes, remainingNodeIds }) => ({ claimedNodeIds: remainingNodeIds, order: ['history', 'vendor.a', 'vendor.body', 'input', 'vendor.b'].map(kind => nodes.find(n => n.source.module === kind).id) }) })
  const p = { ...preset, backend: 'native', layout: { ...layout, identity: 'position', priority: ['vendor.order', 'preset', 'resource', 'default'] }, rules: ['vendor.a', 'vendor.b', 'vendor.body', 'history', 'input'].map((kind, i) => ({ id: `r${i}`, kind })) }
  const result = assembleRequest({ registry, preset: p, nativeMessages: [{ id: 'old', role: 'user', content: [{ type: 'text', text: 'OLD' }] }, { id: 'now', role: 'user', content: [{ type: 'text', text: 'NOW' }] }], inputIds: ['now'] })
  assert.deepEqual(result.messages.map(m => m.content[0].text), ['OLD', 'A', 'BODY', 'NOW', 'B'])
  assert.ok(result.messages.every(m => m.role === 'user'))
})
