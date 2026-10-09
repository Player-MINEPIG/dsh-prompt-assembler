import test from 'node:test'
import assert from 'node:assert/strict'
import { RequestSourceRegistry } from '../src/registry.js'
import { assembleRequest, textOf } from '../src/assemble.js'
import { createDshRegistry } from '../adapters/dsh.js'
import { FORMAT } from '../src/model.js'

const text = (id, value = id, role = 'system') => ({ id, type: 'text', text: value, role })
const reference = (id, sourceId, extra = {}) => ({ id, type: 'reference', sourceId, ...extra })
const native = id => ({ id, role: 'user', content: [{ type: 'text', text: id }], source: { kind: 'user' } })
const source = (id, blocks, extra = {}) => ({ id, pluginId: 'vendor', name: id, resolve: () => ({ blocks }), ...extra })
const preset = kinds => ({ format: FORMAT, version: 1, name: 'Vendor layout', backend: 'native', placement: 'native-slots', rules: kinds.map(kind => ({ id: kind.replaceAll('.', '-'), kind })) })
function assemble(registry, kinds) {
  return assembleRequest({ registry, preset: preset(kinds), nativeMessages: [native('OLD'), native('NOW')], inputIds: ['NOW'] })
}
function registerPrompt(registry, id, capability = {}) {
  registry.register(source('vendor.data', [text('body', 'DATA')]))
  registry.register(source(id, [text('head', 'HEAD'), reference('history', 'history'), reference('data', 'vendor.data', { role: 'user' }), reference('input', 'input'), text('tail', 'TAIL', 'user')], {
    dependencies: ['vendor.data', 'history', 'input'], ...capability,
  }))
}

test('third-party slot owners retain standard native slots, authored identity and delivery', () => {
  const registry = createDshRegistry()
  registerPrompt(registry, 'vendor.prompt', { ownsSlots: true })
  const result = assemble(registry, ['vendor.prompt', 'history', 'input'])
  assert.deepEqual(result.messages.map(textOf), ['HEAD', 'OLD', 'DATA', 'NOW', 'TAIL'])
  assert.deepEqual(result.messages.map(m => m.role), ['system', 'user', 'user', 'user', 'user'])
  assert.ok(result.nodes.every(n => n.slotOwner === 'vendor.prompt'))
  assert.equal(result.nodes.find(n => n.source.module === 'vendor.data').placementSource, 'vendor.prompt')
  assert.equal(result.nodes.find(n => n.source.module === 'vendor.data').nativeDelivery, 'pre-step')
  assert.equal(result.placementControls.find(c => c.ruleId === 'vendor-prompt').control, 'preset')
  assert.ok(!result.diagnostics.some(d => d.code === 'NATIVE_SLOTS_ABSENT'))
})

test('ordinary reference sources do not acquire slot ownership or authored role privileges', () => {
  const registry = createDshRegistry()
  registerPrompt(registry, 'vendor.prompt')
  const result = assemble(registry, ['vendor.prompt', 'history', 'input'])
  assert.ok(result.nodes.every(n => n.slotOwner === undefined))
  assert.equal(result.nodes.find(n => n.source.module === 'vendor.data').role, 'system')
  assert.ok(result.diagnostics.some(d => d.code === 'NATIVE_SLOTS_ABSENT'))
  assert.equal(registry.list().find(s => s.id === 'vendor.prompt').ownsSlots, false)
})

test('slot ownership propagates through nested references without changing source identity', () => {
  const registry = createDshRegistry()
  registry.register(source('vendor.data', [text('body', 'DATA')]))
  registry.register(source('vendor.nested', [reference('history', 'history'), reference('data', 'vendor.data'), reference('input', 'input')], { dependencies: ['history', 'input', 'vendor.data'] }))
  registry.register(source('vendor.prompt', [reference('nested', 'vendor.nested', { role: 'user' })], { ownsSlots: true, dependencies: ['vendor.nested'] }))
  const result = assemble(registry, ['vendor.prompt', 'history', 'input'])
  assert.deepEqual(result.messages.map(textOf), ['OLD', 'DATA', 'NOW'])
  assert.equal(result.nodes.find(n => n.source.module === 'vendor.data').role, 'user')
  assert.ok(result.nodes.every(n => n.slotOwner === 'vendor.prompt'))
  assert.ok(result.nodes.every(n => n.placementSource === 'vendor.prompt'))
})

test('multiple owner spines preserve authored order and anchor independent modules at the corresponding owner', () => {
  const registry = createDshRegistry()
  registry.register(source('vendor.first', [reference('history', 'history'), text('a', 'A', 'user')], { ownsSlots: true, dependencies: ['history'] }))
  registry.register(source('vendor.middle', [text('m', 'MID', 'user')]))
  registry.register(source('vendor.second', [text('b', 'B', 'user'), reference('input', 'input')], { ownsSlots: true, dependencies: ['input'] }))
  const p = preset(['vendor.first', 'vendor.middle', 'vendor.second', 'history', 'input'])
  p.rules.find(r => r.kind === 'vendor.middle').delivery = 'pre-step'
  const result = assembleRequest({ registry, preset: p, nativeMessages: [native('OLD'), native('NOW')], inputIds: ['NOW'] })
  assert.deepEqual(result.messages.map(textOf), ['OLD', 'A', 'MID', 'B', 'NOW'])
  assert.deepEqual(result.nodes.filter(n => n.slotOwner).map(n => n.slotOwner), ['vendor.first', 'vendor.first', 'vendor.second', 'vendor.second'])
  assert.equal(result.nodes.find(n => n.source.module === 'vendor.middle').slotOwner, undefined)
})

test('ownsSlots validates explicit capability and preserves legacy preset defaults', () => {
  for (const invalid of [null, 1, 'true', {}]) {
    const registry = new RequestSourceRegistry()
    assert.throws(() => registry.register(source('vendor.prompt', [], { ownsSlots: invalid })), /ownsSlots must be a boolean/)
    assert.deepEqual(registry.list(), [])
  }
  const registry = createDshRegistry()
  registerPrompt(registry, 'preset')
  assert.equal(registry.list().find(s => s.id === 'preset').ownsSlots, true)
  const result = assemble(registry, ['preset', 'history', 'input'])
  assert.deepEqual(result.messages.map(textOf), ['HEAD', 'OLD', 'DATA', 'NOW', 'TAIL'])
  assert.ok(result.nodes.every(n => n.slotOwner === 'preset'))
  const ordinary = createDshRegistry()
  registerPrompt(ordinary, 'preset', { ownsSlots: false })
  assert.ok(assemble(ordinary, ['preset', 'history', 'input']).nodes.every(n => n.slotOwner === undefined))
})

test('implicit dependencies use their declared role and retention capabilities; explicit rules still win', () => {
  for (const lifetimes of [['request'], ['snapshot']]) {
    const registry = new RequestSourceRegistry()
    let resolvedRule
    registry.register(source('vendor.data', [], { roles: ['system'], lifetimes, depth: false, resolve: (_ctx, rule) => {
      resolvedRule = rule
      return { blocks: [text('body', 'DATA')] }
    } }))
    registry.register(source('vendor.prompt', [reference('data', 'vendor.data')], { dependencies: ['vendor.data'] }))
    const p = { format: FORMAT, version: 1, name: 'Dependency', placement: 'st', rules: [{ id: 'prompt', kind: 'vendor.prompt' }] }
    const result = assembleRequest({ registry, preset: p })
    assert.deepEqual(result.messages.map(textOf), ['DATA'])
    assert.equal(resolvedRule.role, 'system')
    assert.equal(resolvedRule.lifetime, lifetimes[0])
    assert.equal(resolvedRule.depth, null)
    assert.equal(resolvedRule.enabled, false)
    assert.equal(result.snapshots.length, lifetimes[0] === 'snapshot' ? 1 : 0)
    assert.throws(() => assembleRequest({ registry, preset: { ...p, rules: [...p.rules, { id: 'data', kind: 'vendor.data', enabled: false, role: 'user', lifetime: lifetimes[0] }] } }), /Unsupported rule settings/)
  }
})
