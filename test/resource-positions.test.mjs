import test from 'node:test'
import assert from 'node:assert/strict'
import { assembleRequest, textOf } from '../src/assemble.js'
import { normalizePreset } from '../src/model.js'
import { createDefaultRegistry, DEFAULT_RULES, registerTavernMvuSource } from '../adapters/tavern.js'
import { positionRows, configurePosition, normalizePositions, positionKey, applyPositionStrategies, resolvedPositionRows } from '../src/resource-positions.js'
const policy = { version: 1, source: 'preset-slots', identity: 'preserve', fallback: 'source-order', priority: 'user', overrides: [] }
const preset = backend => normalizePreset({ format: 'dsh-tavern-request-assembly', version: 1, name: 'Positions', backend, rules: DEFAULT_RULES, layout: policy })
const position = (sourceId, positionId, placement = 'source', enabled = true) => ({ sourceId, positionId, placement, enabled })
const marker = identifier => ({ identifier, marker: true, enabled: true, role: 'system' })
const assets = { preset: { id: 'p1', prompts: [marker('worldInfoBefore'), marker('worldInfoAfter'), marker('charDescription'), marker('chatHistory')] }, character: { id: 'c1', data: { description: 'CHARACTER' } }, loreEntries: [{ id: 'a', resourceId: 'book1', position: 'before', content: 'BEFORE' }, { id: 'b', resourceId: 'book1', position: 'after', content: 'AFTER' }] }
const run = (p, a = assets, registry = createDefaultRegistry()) => assembleRequest({ registry, preset: p, assets: a, nativeMessages: [{ id: 'head', role: 'system', content: [{ type: 'text', text: 'NATIVE' }] }, { id: 'old', role: 'user', content: [{ type: 'text', text: 'OLD' }] }, { id: 'now', role: 'user', content: [{ type: 'text', text: 'NOW' }] }], inputIds: ['now'] })
const withPositions = (p, positions, priority = 'user') => ({ ...p, layout: { ...p.layout, positions, priority } })

test('position catalogue includes empty macro targets, all worldbook positions and inactive MVU', () => {
  const registry = createDefaultRegistry()
  registerTavernMvuSource(registry, { hasModule: () => false, resolveRequest: () => ({ blocks: [] }), validateResolved() {} })
  const rows = positionRows(preset('native'), registry.list())
  assert.ok(rows.find(r => r.sourceId === 'character' && r.positionId === 'description').position.macros.includes('description'))
  assert.deepEqual(rows.filter(r => r.sourceId === 'worldbook').map(r => r.positionId), ['before', 'after', 'before_example_messages', 'after_example_messages', 'before_author_note', 'after_author_note', 'depth', 'outlet'])
  assert.equal(rows.find(r => r.sourceId === 'tavern.mvu/state').source.moduleAvailable, false)
  assert.ok(!rows.some(r => r.sourceId === 'tavern.text'))
})
for (const backend of ['core', 'native']) {
  test(`${backend}: configured order resolves two preset slots according to selected priority`, () => {
    const positions = [position('worldbook', 'after', 'list'), position('worldbook', 'before'), position('character', 'description')]
    const user = run(withPositions(preset(backend), positions))
    assert.ok(user.messages.map(textOf).indexOf('AFTER') < user.messages.map(textOf).indexOf('BEFORE'))
    assert.equal(user.nodes.find(n => n.text === 'AFTER').positionDecision, 'user')
    const slots = run(withPositions(preset(backend), positions.map(p => ({ ...p, placement: 'source' })), 'preset'))
    assert.ok(slots.messages.map(textOf).indexOf('BEFORE') < slots.messages.map(textOf).indexOf('AFTER'))
    assert.equal(slots.nodes.find(n => n.text === 'AFTER').positionDecision, 'preset')
  })
  test(`${backend}: switches suppress slot content and inline macros without leaving duplicate fallback`, () => {
    const p = withPositions(preset(backend), [position('character', 'description', 'source', false), position('worldbook', 'after', 'source', false)])
    const a = { ...assets, preset: { id: 'p', prompts: [{ identifier: 'main', enabled: true, role: 'system', content: 'TEXT {{description}}' }, ...assets.preset.prompts] } }
    const result = run(p, a)
    assert.ok(!result.messages.map(textOf).join(' ').includes('CHARACTER'))
    assert.ok(!result.messages.map(textOf).includes('AFTER'))
    assert.ok(result.resourceLayout.positionDecisions.some(d => d.positionId === 'after' && d.decision === 'disabled'))
  })
  test(`${backend}: strategy is reusable with different assets and newly triggered entries`, () => {
    const p = withPositions(preset(backend), [position('worldbook', 'after', 'list'), position('worldbook', 'before')])
    const result = run(p, { ...assets, preset: { ...assets.preset, id: 'p2' }, loreEntries: [...assets.loreEntries.map(e => ({ ...e, id: 'new-' + e.id, resourceId: 'book2' })), { id: 'extra', resourceId: 'book2', position: 'after', content: 'EXTRA' }] })
    assert.deepEqual(result.nodes.filter(n => n.source.module === 'worldbook').map(n => n.text), ['AFTER', 'EXTRA', 'BEFORE'])
    assert.ok(!JSON.stringify(p.layout).includes('book1'))
  })
}
test('moving a macro target detaches its inline use into one independently ordered field', () => {
  const p = withPositions(preset('core'), [position('character', 'description', 'list'), position('preset', 'main')])
  const result = run(p, { ...assets, preset: { prompts: [{ identifier: 'main', enabled: true, role: 'system', content: 'PREFIX {{description}} SUFFIX' }] } })
  assert.equal(result.messages.filter(m => textOf(m).includes('CHARACTER')).length, 1)
  assert.equal(result.nodes.find(n => n.text === 'CHARACTER').positionDecision, 'user')
})
test('explicit depth override becomes a list position while an unchanged position retains its depth', () => {
  const data = { ...assets, loreEntries: [{ id: 'depth', resourceId: 'w', requestedPosition: 'at_depth', position: 'after', depth: 1, content: 'DEPTH' }] }
  const positions = [position('worldbook', 'depth', 'list'), position('character', 'description')]
  const result = run(withPositions(preset('core'), positions), data)
  assert.equal(run(preset('core'), data).nodes.find(n => n.text === 'DEPTH').depth, 1)
  assert.equal(result.nodes.find(n => n.text === 'DEPTH').depth, null)
  assert.ok(result.messages.map(textOf).indexOf('DEPTH') < result.messages.map(textOf).indexOf('CHARACTER'))
})
test('native history and input cannot be disabled or moved by position policy', () => {
  const p = withPositions(preset('native'), [position('input', 'content', 'list', false), position('history', 'content', 'list'), position('worldbook', 'after', 'list')])
  const result = run(p)
  assert.deepEqual(result.messages.filter(m => ['old', 'now'].includes(m.id)).map(m => m.id), ['old', 'now'])
  assert.ok(result.diagnostics.some(d => d.code === 'POSITION_CONFLICT' && d.winner === 'runtime'))
})
test('MVU positions can be enabled before content exists and reordered after activation', () => {
  const registry = createDefaultRegistry()
  registerTavernMvuSource(registry, { hasModule: () => false, resolveRequest: () => ({ blocks: [{ type: 'text', id: 'revision-dependent', text: 'MVU', source: { field: 'stat_data', resourceId: 'state-1' } }] }), validateResolved() {} })
  const key = positionKey('tavern.mvu/state', 'stat_data')
  let p = configurePosition(preset('core'), registry.list(), key, { enabled: true })
  p = configurePosition(p, registry.list(), key, {}, positionKey('worldbook', 'before'))
  const result = run(p, assets, registry)
  assert.ok(result.messages.map(textOf).indexOf('MVU') < result.messages.map(textOf).indexOf('BEFORE'))
})
test('missing provider follows saved fallback and serialization rejects duplicate positions', () => {
  const p = withPositions(preset('core'), [position('missing.plugin', 'content', 'list')])
  assert.ok(run(p).diagnostics.some(d => d.code === 'POSITION_SOURCE_MISSING'))
  assert.throws(() => run({ ...p, layout: { ...p.layout, fallback: 'error' } }), /unavailable/)
  assert.throws(() => normalizePositions([position('worldbook', 'after'), position('worldbook', 'after')]), /Invalid/)
  assert.deepEqual(normalizePreset(p).layout.positions, p.layout.positions)
})

test('disabling other preset text leaves its structural worldbook slots intact', () => {
  const p = withPositions(preset('core'), [position('preset', 'body', 'source', false)])
  const result = run(p)
  assert.equal(result.nodes.find(n => n.text === 'AFTER').positionDecision, 'preset')
  assert.equal(result.nodes.find(n => n.text === 'BEFORE').positionDecision, 'preset')
})
test('disabling a character system override restores the preset-authored main text', () => {
  const p = withPositions(preset('core'), [position('character', 'system', 'source', false)])
  const data = { ...assets, character: { data: { systemPrompt: 'CHAR_OVERRIDE' } }, preset: { prompts: [{ identifier: 'main', enabled: true, role: 'system', content: 'PRESET_MAIN' }] } }
  const result = run(p, data)
  assert.ok(result.messages.some(m => textOf(m) === 'PRESET_MAIN'))
  assert.ok(!result.messages.some(m => textOf(m).includes('CHAR_OVERRIDE')))
})
test('authored worldbook before/after names use their stable semantic positions', () => {
  const p = withPositions(preset('core'), [position('worldbook', 'after', 'source', false)])
  const result = run(p, { ...assets, loreEntries: assets.loreEntries.map(e => ({ ...e, requestedPosition: e.position === 'before' ? 'before_character_definition' : 'after_character_definition' })) })
  assert.deepEqual(result.nodes.filter(n => n.source.module === 'worldbook').map(n => n.text), ['BEFORE'])
})
test('toggling an existing disabled source enables only the selected position', () => {
  const registry = createDefaultRegistry(), original = preset('core')
  original.rules.find(r => r.kind === 'worldbook').enabled = false
  const p = configurePosition(original, registry.list(), positionKey('worldbook', 'after'), { enabled: true })
  assert.deepEqual(run(p).nodes.filter(n => n.source.module === 'worldbook').map(n => n.text), ['AFTER'])
})

const permutations = values => values.length ? values.flatMap((v, i) => permutations(values.filter((_, at) => at !== i)).map(rest => [v, ...rest])) : [[]]
for (const backend of ['native', 'core']) test(`${backend}: all six automatic priorities preserve explicit custom positions`, () => {
  const base = preset(backend)
  base.rules = [...base.rules.filter(r => r.kind !== 'worldbook' && r.kind !== 'character'), base.rules.find(r => r.kind === 'worldbook'), base.rules.find(r => r.kind === 'character')]
  const data = { ...assets, preset: { id: 'p', prompts: [marker('worldInfoAfter'), marker('charDescription'), marker('chatHistory')] }, loreEntries: [{ id: 'after', position: 'after', content: 'AFTER' }] }
  const positions = [position('character', 'description'), position('worldbook', 'after', 'list')]
  for (const priority of permutations(['preset', 'resource', 'default'])) {
    const result = run(withPositions(base, positions, priority), data)
    const after = result.nodes.findIndex(n => n.text === 'AFTER'), character = result.nodes.findIndex(n => n.text === 'CHARACTER')
    assert.equal(after > character, true, `${backend}: ${priority.join(' > ')}`)
  }
})
test('resource-first preserves authored depth while default-first supersedes depth and user order', () => {
  const data = { ...assets, loreEntries: [{ id: 'depth', requestedPosition: 'at_depth', depth: 1, content: 'DEPTH' }] }
  const positions = [position('worldbook', 'depth'), position('character', 'description')]
  const resource = run(withPositions(preset('core'), positions, ['resource', 'user', 'preset', 'default']), data)
  assert.equal(resource.nodes.find(n => n.text === 'DEPTH').depth, 1)

  const fallback = run(withPositions(preset('core'), positions, ['default', 'resource', 'preset', 'user']), data)
  assert.equal(fallback.nodes.find(n => n.text === 'DEPTH').depth, null)

})
test('priority permutations round-trip while incomplete and duplicate lists are rejected', () => {
  const p = withPositions(preset('core'), [], ['resource', 'default', 'preset', 'user'])
  assert.deepEqual(normalizePreset(p).layout.priority, ['resource', 'default', 'preset'])
  for (const priority of [['user'], ['user', 'preset', 'user', 'default'], ['user', 'preset', 'resource', 'runtime']]) assert.throws(() => normalizePreset({ ...p, layout: { ...p.layout, priority } }), /priority/)
})

test('sorting passes consume resources once and only move the remaining resources', () => {
  const nodes = [
    { id: 'character', source: { module: 'character', field: 'description' }, positionId: 'description' },
    { id: 'lore', source: { module: 'worldbook' }, positionId: 'before', resourceAnchor: { sourceId: 'character', fields: ['description'], side: 'before' } },
    { id: 'preset', source: { module: 'preset' }, positionId: 'main', slotId: 'slot' },
    { id: 'tail', source: { module: 'other' }, positionId: 'content' },
  ].map(n => ({ ...n, role: 'system', lifetime: 'request' }))
  const p = withPositions(preset('core'), [{ ...position('character', 'description', 'list'), anchor: { sourceId: 'preset', positionId: 'main', side: 'after' } }, position('preset', 'main')], ['user', 'preset', 'resource', 'default'])
  const stages = applyPositionStrategies(nodes, p, [])
  assert.deepEqual(stages, [
    { strategy: 'user', nodeIds: ['character'] },
    { strategy: 'preset', nodeIds: ['preset'] },
    { strategy: 'resource', nodeIds: ['lore'] },
    { strategy: 'default', nodeIds: ['tail'] },
  ])
  assert.deepEqual(nodes.map(n => n.id), ['lore', 'preset', 'character', 'tail'], 'manual anchor follows automatic placement without being claimed by it')
  const presetFirst = withPositions(p, p.layout.positions, ['default', 'user', 'resource', 'preset'])
  const original = structuredClone(nodes)
  const claimed = applyPositionStrategies(nodes, presetFirst, [])
  assert.deepEqual(nodes.map(n => n.id), original.map(n => n.id))
  assert.equal(claimed[0].nodeIds.length, 1, 'manual item is excluded from automatic priority')
  assert.equal(claimed[1].nodeIds.length, 3)
  assert.ok(claimed.slice(2).every(s => s.nodeIds.length === 0), 'later automatic rules cannot touch resources consumed by default')
})


test('toggling native instructions keeps source roles and never forces slot identity adaptation', () => {
  const registry=createDefaultRegistry()
  const data={preset:{prompts:[
    {identifier:'user-head',enabled:true,role:'user',content:'USER BEFORE HISTORY'},
    marker('chatHistory'),
    {identifier:'system-tail',enabled:true,role:'system',content:'SYSTEM AFTER HISTORY'}
  ]},loreEntries:[{id:'depth',resourceId:'book',position:'after',requestedPosition:'at_depth',depth:0,role:'system',content:'SYSTEM DEPTH ZERO'}]}
  let p=preset('native')
  for(const enabled of [false,true,false]) {
    p=configurePosition(p,registry.list(),positionKey('native-system','content'),{enabled})
    const normalized=normalizePreset(p)
    assert.equal(normalized.placement,'native-roles')
    const result=run(normalized,data,registry)
    assert.equal(result.messages.some(m=>textOf(m)==='NATIVE'),enabled)
    for(const text of ['SYSTEM AFTER HISTORY','SYSTEM DEPTH ZERO'])assert.equal(result.nodes.find(n=>n.text===text).role,'system')
    assert.equal(result.nodes.find(n=>n.text==='USER BEFORE HISTORY').role,'user')
    const history=result.nodes.findIndex(n=>n.source.module==='history')
    assert(result.nodes.findIndex(n=>n.text==='SYSTEM AFTER HISTORY')<history)
    assert(result.nodes.findIndex(n=>n.text==='USER BEFORE HISTORY')>history)
    assert(!result.diagnostics.some(d=>d.code==='NATIVE_ROLE_ADJUSTED'))
  }
})

for (const identity of ['position', 'preserve']) test(`native: manual depth tail is resolved before identity projection (${identity})`, () => {
  const registry = createDefaultRegistry()
  const base = preset('native')
  base.layout = { ...base.layout, identity, priority: ['user', 'preset', 'resource', 'default'] }
  const moved = configurePosition(base, registry.list(), positionKey('worldbook', 'depth'), {}, null)
  const data = { ...assets, preset: { prompts: [
    { identifier: 'open', enabled: true, role: 'system', content: 'OPEN' },
    marker('chatHistory'),
    { identifier: 'close', enabled: true, role: 'user', content: 'CLOSE' },
  ] }, loreEntries: [0, 1, 2].map(id => ({ id: String(id), requestedPosition: 'at_depth', depth: 0, role: 'system', content: `DEPTH ${id}` })) }
  const result = run(moved, data)
  const depth = result.nodes.filter(n => n.source.module === 'worldbook')
  assert.deepEqual(depth.map(n => n.text), ['DEPTH 0', 'DEPTH 1', 'DEPTH 2'])
  assert(depth.every(n => n.depth == null && n.nativeRequestedDepth == null))
  if (identity === 'position') {
    assert.deepEqual(result.messages.map(textOf).slice(-4), ['CLOSE', 'DEPTH 0', 'DEPTH 1', 'DEPTH 2'])
    assert(depth.every(n => n.role === 'user' && n.nativePlacement === 'after-input' && n.nativeDelivery === 'pre-step'))
    assert(!result.diagnostics.some(d => d.code === 'POSITION_CONFLICT' && d.sourceId === 'worldbook'))
    const restored = run(configurePosition(moved, registry.list(), positionKey('worldbook', 'depth'), { placement: 'source' }), data)
    assert(restored.nodes.filter(n => n.source.module === 'worldbook').every(n => n.nativeDepthAnchor === 'after-history'))
  } else {
    assert(depth.every(n => n.role === 'system'))
    assert(result.nodes.indexOf(depth.at(-1)) < result.nodes.findIndex(n => n.source.module === 'history'))
    assert(result.diagnostics.some(d => d.code === 'POSITION_CONFLICT' && d.winner === 'runtime'))
  }
})

test('explicit position anchors round-trip and determine placement independently of catalogue order', () => {
  const original = preset('core'), registry = createDefaultRegistry()
  let p = configurePosition(original, registry.list(), positionKey('worldbook', 'after'), {}, positionKey('character', 'description'))
  const move = p.layout.positions.find(x => x.sourceId === 'worldbook' && x.positionId === 'after')
  assert.deepEqual(move.anchor, { sourceId: 'character', positionId: 'description', side: 'before' })
  p.layout.positions.reverse()
  const result = run(normalizePreset(p))
  const at = result.nodes.findIndex(n => n.text === 'AFTER')
  assert.equal(result.nodes[at + 1].text, 'CHARACTER')
  p = configurePosition(p, registry.list(), positionKey('worldbook', 'after'), { placement: 'source' })
  assert.equal(p.layout.positions.find(x => x.sourceId === 'worldbook' && x.positionId === 'after').anchor, undefined)
})
test('resolved editor rows follow definite positions while preserving empty and split categories', () => {
  const p = preset('core'), sources = createDefaultRegistry().list()
  const result = run(p)
  const rows = resolvedPositionRows(p, sources, result)
  const known = rows.filter(r => r.resolved).map(r => r.key)
  assert(known.indexOf('worldbook#after') < known.indexOf('character#description'))
  assert(rows.some(r => r.sourceId === 'worldbook' && r.positionId === 'depth' && !r.resolved))
  const repeated = { nodes: [...result.nodes, result.nodes.find(n => n.text === 'BEFORE')] }
  assert.equal(resolvedPositionRows(p, sources, repeated).find(r => r.key === 'worldbook#before').split, true)
})

for (const backend of ['native', 'core']) test(`${backend}: automatic precedence still changes non-custom placement`, () => {
  const base = preset(backend)
  base.rules = [...base.rules.filter(r => r.kind !== 'worldbook' && r.kind !== 'character'), base.rules.find(r => r.kind === 'worldbook'), base.rules.find(r => r.kind === 'character')]
  const data = { ...assets, preset: { prompts: [marker('worldInfoAfter'), marker('charDescription'), marker('chatHistory')] }, loreEntries: [{ id: 'after', position: 'after', content: 'AFTER' }] }
  for (const priority of permutations(['preset', 'resource', 'default'])) {
    const result = run(withPositions(base, [], priority), data)
    assert.equal(result.nodes.findIndex(n => n.text === 'AFTER') > result.nodes.findIndex(n => n.text === 'CHARACTER'), priority[0] === 'resource')
  }
})
test('a custom position follows an automatically relocated anchor; manual cycles are rejected', () => {
  const nodes = [
    { id: 'lore', source: { module: 'worldbook' }, positionId: 'after', resourceAnchor: { sourceId: 'character', side: 'after' } },
    { id: 'manual', source: { module: 'custom' }, positionId: 'content' },
    { id: 'character', source: { module: 'character' }, positionId: 'description' },
  ].map(n => ({ ...n, role: 'system', lifetime: 'request' }))
  const positions = [{ ...position('custom', 'content', 'list'), anchor: { sourceId: 'worldbook', positionId: 'after', side: 'before' } }]
  for (const priority of [['resource', 'preset', 'default'], ['default', 'resource', 'preset']]) {
    const ordered = structuredClone(nodes)
    applyPositionStrategies(ordered, withPositions(preset('core'), positions, priority), [])
    assert.deepEqual(ordered.map(n => n.id), priority[0] === 'resource' ? ['character', 'manual', 'lore'] : ['manual', 'lore', 'character'])
  }
  const cycle = [...positions, { ...position('worldbook', 'after', 'list'), anchor: { sourceId: 'custom', positionId: 'content', side: 'before' } }]
  assert.throws(() => applyPositionStrategies(structuredClone(nodes), withPositions(preset('core'), cycle, ['preset', 'resource', 'default']), []), /Cyclic manual/)
})
test('dragging two custom positions into the opposite order replaces the old anchor dependency', () => {
  const registry = createDefaultRegistry()
  let p = configurePosition(preset('core'), registry.list(), 'worldbook#after', {}, 'worldbook#before')
  p = configurePosition(p, registry.list(), 'worldbook#before', {}, 'worldbook#after')
  assert.deepEqual(run(p).nodes.filter(n => n.source.module === 'worldbook').map(n => n.text), ['BEFORE', 'AFTER'])
})
