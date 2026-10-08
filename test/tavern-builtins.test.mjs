import { MODULE_ORDER, NATIVE_PHI_LAST, NATIVE_LORE_LAST } from './fixtures/assembly-references.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BUILTINS, NATIVE_BUILTINS, NATIVE_RULES, createDefaultRegistry } from '../adapters/tavern.js'
import { AssemblyPresetStore } from '../adapters/tavern-runtime.js'
import { assembleRequest, textOf } from '../src/assemble.js'
const presets = [...NATIVE_BUILTINS, ...BUILTINS]
const prompt = (identifier, content, role = 'system') => ({ identifier, content, role, enabled: true })
const nativeMessages = ['OLD', 'NOW'].map(id => ({ id, role: 'user', content: [{ type: 'text', text: id }] }))
const assets = { preset: { prompts: [prompt('main', 'HEAD', 'user'), { ...prompt('worldInfoBefore'), marker: true }, { ...prompt('chatHistory'), marker: true }, prompt('jailbreak', 'TAIL')] }, loreEntries: [{ id: 'w', content: 'LORE', position: 'before', role: 'system' }] }
const run = (id, data = assets) => assembleRequest({ registry: createDefaultRegistry(), preset: presets.find(p => p.id === id), nativeMessages, inputIds: ['NOW'], assets: data })
const pairs = id => run(id).messages.map(m => [textOf(m), m.role])
test('reference catalog has distinct effects and names explain placement rather than promise ST or cache parity', () => {
  assert.deepEqual(presets.map(p => p.id).sort(), ['builtin-native-roles', 'builtin-native-slots', 'builtin-st'])
  assert.ok(presets.every(p => !/ST 风格|ST 兼容|缓存友好|追加快照/.test(p.name)))
  assert.equal(new Set(presets.map(p => JSON.stringify([pairs(p.id), run(p.id, { ...assets, preset: { prompts: [assets.preset.prompts[0], assets.preset.prompts[2], assets.preset.prompts[1], assets.preset.prompts[3]] } }).messages.map(m => [textOf(m), m.role]) ]))).size, presets.length)
  assert.deepEqual(pairs('builtin-native-slots'), [['HEAD','system'],['LORE','system'],['OLD','user'],['NOW','user'],['TAIL','user']])
  assert.deepEqual(pairs('builtin-st'), [['HEAD','user'],['LORE','system'],['OLD','user'],['NOW','user'],['TAIL','system']])
  assert.deepEqual(pairs('builtin-native-roles'), [['LORE','system'],['TAIL','system'],['OLD','user'],['NOW','user'],['HEAD','user']])
  for (const id of ['builtin-native-slots','builtin-st']) assert.deepEqual(run(id).resourceLayout.policy.priority, ['preset','resource','default'])
})
test('RP defaults to standard slots; withdrawn built-ins, explicit opt-outs and custom snapshots survive restart unchanged', () => {
  const root = mkdtempSync(join(tmpdir(), 'builtin-catalog-'))
  try {
    let mode = 'play'
    const store = new AssemblyPresetStore(root, { mode: () => mode })
    assert.equal(store.selection('new').id, 'builtin-native-slots')
    mode = 'native'; assert.equal(store.selection('new'), null); mode = 'play'
    const old = { ...NATIVE_PHI_LAST, id: 'builtin-native-st', name: 'ST 风格（原生）', rules: NATIVE_RULES }
    store.applySnapshot('old', old)
    store.applySnapshot('snapshot', { ...MODULE_ORDER, id: 'builtin-snapshots', rules: MODULE_ORDER.rules.map(r => r.kind === 'worldbook' ? { ...r, lifetime: 'snapshot' } : r) })
    const custom = store.save({ ...NATIVE_BUILTINS[0], name: 'My custom policy' }); store.apply('custom', custom.id)
    store.apply('off', null)
    for (const [id, preset] of [['builtin-cache', MODULE_ORDER], ['builtin-native-cache', NATIVE_LORE_LAST], ['builtin-native-phi', NATIVE_PHI_LAST]]) store.applySnapshot(id, { ...preset, id })
    const before = readFileSync(store.path)
    const reopened = new AssemblyPresetStore(root, { mode: () => mode })
    for (const id of ['old','snapshot','custom','off','builtin-cache','builtin-native-cache','builtin-native-phi']) assert.deepEqual(reopened.selection(id), store.selection(id))
    assert.ok(!reopened.list().some(p => ['builtin-native-st','builtin-snapshots','builtin-cache','builtin-native-cache','builtin-native-phi'].includes(p.id)))
    assert.deepEqual(readFileSync(store.path), before)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
