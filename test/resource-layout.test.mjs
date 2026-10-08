import test from 'node:test'
import assert from 'node:assert/strict'
import { assembleRequest, textOf } from '../src/assemble.js'
import { normalizePreset } from '../src/model.js'
import { withBlockMove } from '../src/resource-layout.js'
import { createDefaultRegistry, DEFAULT_RULES } from '../adapters/tavern.js'
const prompt = (identifier, content, role = 'system') => ({ identifier, content, role, enabled: true })
const policy = { version: 1, source: 'preset-slots', identity: 'preserve', fallback: 'source-order', overrides: [] }
const base = normalizePreset({ format: 'dsh-tavern-request-assembly', version: 1, name: 'layout', backend: 'core', rules: DEFAULT_RULES, layout: policy })
const assets = { preset: { id: 'p', prompts: [prompt('p', 'HEAD{{worldInfoBefore}}{{history}}{{input}}TAIL')] }, loreEntries: [{ id: 'a', resourceId: 'book', position: 'before', content: 'A' }, { id: 'b', resourceId: 'book', position: 'after', content: 'B' }, { id: 'c', resourceId: 'book', position: 'after', content: 'C' }] }
const run = (preset = base, data = assets) => assembleRequest({ registry: createDefaultRegistry(), preset, assets: data, nativeMessages: [{ id: 'old', role: 'user', content: [{ type: 'text', text: 'OLD' }] }, { id: 'now', role: 'user', content: [{ type: 'text', text: 'NOW' }] }], inputIds: ['now'] })
const contains = (layout, text) => layout.blocks.find(b => b.entries.some(e => e.text === text))
test('partially referenced source expands to separate bound and whole free groups', () => {
  const r = run(), a = contains(r.resourceLayout, 'A'), b = contains(r.resourceLayout, 'B')
  assert.equal(a.binding, 'slot'); assert.equal(a.movable, false)
  assert.equal(b.binding, 'free'); assert.deepEqual(b.entries.map(e => e.text), ['B', 'C'])
  assert.ok(r.resourceLayout.slots.every(s => s.emitsText === false))
  assert.deepEqual(a.entries[0].source.resourceId, 'book')
  assert.throws(() => withBlockMove(base, r.resourceLayout, a.id, b.id), /follows a slot/)
})
test('move preserves internal order and new entries join the stable group next request', () => {
  const r = run(), b = contains(r.resourceLayout, 'B'), head = contains(r.resourceLayout, 'HEAD')
  const moved = withBlockMove(base, r.resourceLayout, b.id, head.id)
  const next = run(moved, { ...assets, loreEntries: [...assets.loreEntries, { id: 'new', resourceId: 'book', position: 'after', content: 'NEW' }] })
  assert.deepEqual(next.messages.map(textOf).slice(0, 4), ['B', 'C', 'NEW', 'HEAD'])
  assert.equal(moved.layout.overrides.length, 1); assert.ok(!JSON.stringify(moved.layout).includes('worldbook:new'))
})
test('explicit detach moves slot-bound block and retains original ownership evidence', () => {
  const r = run(), a = contains(r.resourceLayout, 'A'), b = contains(r.resourceLayout, 'B')
  const next = run(withBlockMove(base, r.resourceLayout, a.id, b.id, 'after', true))
  assert.deepEqual(next.messages.map(textOf).slice(-3), ['B', 'C', 'A'])
  assert.equal(next.nodes.find(n => n.text === 'A').originalSlotId, a.slotId)
})
test('missing override diagnoses fallback or rejects explicitly', () => {
  const r = run(), b = contains(r.resourceLayout, 'B'), head = contains(r.resourceLayout, 'HEAD')
  const moved = withBlockMove(base, r.resourceLayout, b.id, head.id)
  const gone = { ...assets, preset: { id: 'different', prompts: [] } }
  assert.ok(run(moved, gone).diagnostics.some(d => d.code === 'LAYOUT_TARGET_MISSING'))
  assert.throws(() => run({ ...moved, layout: { ...moved.layout, fallback: 'error' } }, gone), /no longer available/)
})
test('mixed authored roles preserved by core; native rejects assistant and adapts only when requested', () => {
  const mixed = { preset: { id: 'p', prompts: [prompt('a', 'A', 'user'), prompt('b', '{{history}}{{input}}'), prompt('c', 'C', 'assistant')] } }
  assert.deepEqual(run(base, mixed).messages.map(m => m.role), ['user', 'user', 'user', 'assistant'])
  assert.throws(() => run({ ...base, backend: 'native' }, mixed), /cannot preserve assistant/)
  const r = run({ ...base, backend: 'native', layout: { ...policy, identity: 'position' } }, mixed)
  assert.deepEqual(r.messages.map(m => m.role), ['system', 'user', 'user', 'user'])
  assert.equal(contains(r.resourceLayout, 'C').entries[0].originalRole, 'assistant')
})
test('native moving system across history rejects, context warns about reused position', () => {
  const p = { ...base, backend: 'native', layout: { ...policy, source: 'manual' } }
  const data = { preset: { id: 'p', prompts: [prompt('a', 'SYS'), prompt('b', 'CTX', 'user')] } }
  const r = run(p, data)
  const sys = contains(r.resourceLayout, 'SYS'), input = contains(r.resourceLayout, 'NOW')
  assert.throws(() => run(withBlockMove(p, r.resourceLayout, sys.id, input.id, 'after'), data), /boundary/)
  assert.ok(contains(r.resourceLayout, 'CTX').limitations.includes('NATIVE_CONTEXT_REUSES_HISTORY_POSITION'))
})
test('duplicate and empty slots are visible without duplicated text', () => {
  const r = run(base, { preset: { id: 'p', prompts: [prompt('a', '{{worldInfoBefore}}{{history}}{{history}}')] } })
  assert.equal(r.messages.filter(m => textOf(m) === 'OLD').length, 1)
  assert.ok(r.resourceLayout.slots.some(s => s.targetSourceId === 'worldbook' && !s.nodeIds.length))
  assert.ok(r.diagnostics.some(d => d.code === 'LAYOUT_DUPLICATE_SLOT'))
})
test('legacy saved strategy remains unchanged and explained', () => {
  const legacy = { ...base }; delete legacy.layout
  const p = normalizePreset(legacy)
  assert.equal(p.layout, undefined); assert.equal(run(p).resourceLayout.legacy, true)
  assert.throws(() => withBlockMove(p, run(p).resourceLayout, 'x', 'y'), /Explicitly adopt/)
})
test('repeated explicit detach keeps a stable locator and restored position remains a deliberate action', () => {
  const r = run(), a = contains(r.resourceLayout, 'A'), b = contains(r.resourceLayout, 'B')
  const moved = withBlockMove(base, r.resourceLayout, a.id, b.id, 'after', true)
  const next = run(moved), detached = contains(next.resourceLayout, 'A'), head = contains(next.resourceLayout, 'HEAD')
  assert.equal(detached.id, a.id)
  // Further movement preserves the explicit detach intent.
  const again = withBlockMove(moved, next.resourceLayout, detached.id, head.id, 'before')
  assert.equal(run(again).messages[0].content[0].text, 'A')
})
test('native pre-step free blocks can cross input while preserving user identity', () => {
  const p = normalizePreset({ ...base, backend: 'native', layout: { ...policy, source: 'manual' }, rules: [...DEFAULT_RULES, { id: 'tail', kind: 'dsh.text', inputMode: 'text', text: 'USER NOTE', role: 'user', delivery: 'pre-step' }] })
  const r = run(p), note = contains(r.resourceLayout, 'USER NOTE'), input = contains(r.resourceLayout, 'NOW')
  const next = run(withBlockMove(p, r.resourceLayout, note.id, input.id, 'before'))
  assert.deepEqual(next.messages.map(textOf).slice(-2), ['USER NOTE', 'NOW'])
  assert.equal(next.nodes.find(n => n.text === 'USER NOTE').nativePlacement, 'before-input')
})
test('a split same-role group never silently retargets another run when activation changes', () => {
  const data = { loreEntries: [ { id: 'a', resourceId: 'w', position: 'after', content: 'A' }, { id: 'middle', resourceId: 'w', position: 'after', content: 'M', role: 'user' }, { id: 'b', resourceId: 'w', position: 'after', content: 'B' } ], character: { id: 'c', data: { description: 'C' } } }
  const p = { ...base, layout: { ...policy, source: 'manual' } }, r = run(p, data)
  const moved = withBlockMove(p, r.resourceLayout, contains(r.resourceLayout, 'A').id, contains(r.resourceLayout, 'C').id)
  const next = run(moved, { ...data, loreEntries: data.loreEntries.slice(1) })
  assert.ok(next.diagnostics.some(d => d.code === 'LAYOUT_TARGET_MISSING'))
})
test('manual layout keeps listed character fields independent even when a preset has markers', () => {
  const data = { preset: { id: 'p', prompts: [{ identifier: 'charDescription', enabled: true, marker: true, role: 'user' }] }, character: { id: 'c', data: { description: 'CHAR' } } }
  const p = { ...base, layout: { ...policy, source: 'manual' } }
  assert.equal(contains(run(p, data).resourceLayout, 'CHAR').binding, 'free')
  assert.equal(contains(run(base, data).resourceLayout, 'CHAR').binding, 'slot')
})
test('core slot layouts resolve before/after examples and depth as separate groups', () => {
  const data = { preset: { id: 'p', prompts: [{ identifier: 'dialogueExamples', enabled: true, marker: true, role: 'system' }] }, character: { id: 'c', data: { messageExample: 'EXAMPLE' } }, loreEntries: [
    { id: 'before', requestedPosition: 'before_example_messages', position: 'before', content: 'BEFORE' },
    { id: 'after', requestedPosition: 'after_example_messages', position: 'after', content: 'AFTER' },
    { id: 'depth', requestedPosition: 'at_depth', depth: 1, role: 'user', content: 'DEPTH' },
  ] }
  const r = run(base, data)
  assert.deepEqual(r.messages.map(textOf), ['BEFORE', 'EXAMPLE', 'AFTER', 'OLD', 'DEPTH', 'NOW'])
  assert.equal(contains(r.resourceLayout, 'BEFORE').binding, 'slot')
  assert.equal(contains(r.resourceLayout, 'DEPTH').movable, false)
})
