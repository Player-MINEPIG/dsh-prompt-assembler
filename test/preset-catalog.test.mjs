import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { AssemblyPresetStore } from '../src/store.js'
import { BUILTINS, FORMAT, normalizePreset } from '../src/model.js'

const preset = (id, name = 'Provider preset') => ({ id, format: FORMAT, version: 1, name, rules: [{ id: 'text', kind: 'dsh.text', inputMode: 'text', text: 'Original' }] })
function fixture(t, options) {
  const directory = mkdtempSync(join(tmpdir(), 'assembler-catalog-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return new AssemblyPresetStore(directory, options)
}

test('provider catalog entries are normalized, detached, attributed and read-only without selecting a default', t => {
  const store = fixture(t), input = preset('provider-policy', '  Provider policy  '), before = store.list(), defaultId = store.defaultPresetId
  input.builtin = false; input.pluginId = 'forged'; input.extra = 'discarded'
  const stop = store.registerPresets({ pluginId: 'example.plugin:/catalog', presets: [input] })
  const expected = { ...normalizePreset(input), id: input.id, builtin: true, pluginId: 'example.plugin:/catalog' }
  assert.deepEqual(store.get(input.id), expected)
  assert.deepEqual(store.list().slice(0, before.length), before)
  assert.equal(store.defaultPresetId, defaultId)
  assert.equal(store.selection('new-session'), null)
  assert.equal(existsSync(store.path), false)
  input.name = 'Changed'; input.rules[0].text = 'Changed'
  const returned = store.get(input.id); returned.name = 'Changed again'; returned.rules[0].text = 'Changed again'
  store.list().find(p => p.id === input.id).rules[0].text = 'Changed via list'
  assert.deepEqual(store.get(input.id), expected)
  stop(); assert.deepEqual(store.list(), before)
})

test('all provider and constructor built-ins are protected while copies remain editable', t => {
  const store = fixture(t, { builtins: [...BUILTINS, preset('custom-builtin')] })
  store.registerPresets({ pluginId: 'example', presets: [preset('provider-policy'), preset('builtin-provider')] })
  for (const id of ['builtin-native', 'custom-builtin', 'provider-policy', 'builtin-provider']) {
    assert.throws(() => store.save(preset(id, 'Overwrite'), id), /Copy a built-in/)
    assert.throws(() => store.remove(id), /Built-in presets/)
  }
  assert.equal(existsSync(store.path), false)
  const copy = store.save(store.get('provider-policy'))
  assert.notEqual(copy.id, 'provider-policy'); assert.equal(copy.builtin, undefined); assert.equal(copy.pluginId, undefined)
  assert.equal(store.save({ ...copy, name: 'Edited copy' }, copy.id).name, 'Edited copy')
  store.remove(copy.id); assert.throws(() => store.get(copy.id), { status: 404 })
  assert.throws(() => store.save(preset('builtin-withdrawn'), 'builtin-withdrawn'), /Copy a built-in/)
})

test('duplicate IDs across a registration and every existing catalog area fail atomically', t => {
  const store = fixture(t), saved = store.save(preset('unused'))
  store.registerPresets({ pluginId: 'first', presets: [preset('provider-existing')] })
  const before = store.list(), file = readFileSync(store.path)
  for (const conflictingId of ['fresh-policy', 'builtin-native', 'provider-existing', saved.id]) {
    assert.throws(() => store.registerPresets({ pluginId: 'second', presets: [preset('fresh-policy'), preset(conflictingId)] }), /Duplicate assembly preset/)
    assert.deepEqual(store.list(), before)
    assert.deepEqual(readFileSync(store.path), file)
  }
  assert.throws(() => store.registerPresets({ pluginId: 'second', presets: [preset('fresh-policy'), { ...preset('invalid-policy'), rules: null }] }), /assembly rules/)
  assert.deepEqual(store.list(), before)
})

test('registration validates string identities and excludes prototype IDs before publishing entries', t => {
  const store = fixture(t), before = store.list()
  for (const id of [undefined, null, 1, {}, { toString: () => 'coerced' }, '', 'bad.id', 'bad/id', 'bad id', 'a'.repeat(201), '__proto__', 'constructor', 'prototype']) {
    assert.throws(() => store.registerPresets({ pluginId: 'valid', presets: [preset('fresh-policy'), preset(id)] }), /Invalid registered preset id/)
    assert.deepEqual(store.list(), before)
  }
  for (const pluginId of [undefined, null, 1, {}, { toString: () => 'coerced' }, '', '-bad', 'bad id', 'a'.repeat(161), '__proto__', 'constructor', 'prototype']) {
    assert.throws(() => store.registerPresets({ pluginId, presets: [preset('fresh-policy')] }), /Invalid preset provider pluginId/)
    assert.deepEqual(store.list(), before)
  }
  for (const presets of [undefined, null, {}, 'policy']) assert.throws(() => store.registerPresets({ pluginId: 'valid', presets }), /requires an array/)
  store.registerPresets({ pluginId: 'a'.repeat(160), presets: [preset('a'.repeat(200)), preset('_allowed')] })
  assert.equal(store.list().length, before.length + 2)
})

test('disposers own only their registration and cannot remove later entries with the same identity', t => {
  const store = fixture(t), before = store.list()
  const stopFirst = store.registerPresets({ pluginId: 'same-provider', presets: [preset('first-policy'), preset('shared-policy')] })
  const stopOther = store.registerPresets({ pluginId: 'same-provider', presets: [preset('other-policy')] })
  stopFirst(); stopFirst()
  assert.equal(store.get('other-policy').pluginId, 'same-provider')
  const stopReplacement = store.registerPresets({ pluginId: 'replacement', presets: [preset('shared-policy', 'Replacement')] })
  stopFirst(); assert.equal(store.get('shared-policy').name, 'Replacement')
  stopOther(); assert.equal(store.get('shared-policy').pluginId, 'replacement')
  stopReplacement(); stopReplacement(); assert.deepEqual(store.list(), before)
  const stopEmpty = store.registerPresets({ pluginId: 'empty', presets: [] })
  stopEmpty(); stopEmpty(); assert.deepEqual(store.list(), before)
})

test('applied provider snapshots survive unregister, replacement and restart without persisting catalog entries', t => {
  const store = fixture(t, { unified: true }), input = preset('provider-policy')
  const stop = store.registerPresets({ pluginId: 'example', presets: [input] })
  const applied = store.apply('session', input.id), file = readFileSync(store.path)
  assert.equal(applied.builtin, undefined); assert.equal(applied.pluginId, undefined)
  assert.deepEqual(JSON.parse(file).presets, {})
  stop(); assert.throws(() => store.get(input.id), { status: 404 })
  assert.deepEqual(store.selection('session'), applied)
  assert.deepEqual(readFileSync(store.path), file)
  store.registerPresets({ pluginId: 'replacement', presets: [preset(input.id, 'Replacement')] })
  assert.deepEqual(store.selection('session'), applied)
  const reopened = new AssemblyPresetStore(dirname(store.path), { unified: true })
  assert.deepEqual(reopened.selection('session'), applied)
  assert.deepEqual(reopened.list().map(p => p.id), BUILTINS.map(p => p.id))
})

test('legacy migration rejects provider or built-in catalog collisions atomically without changing either file', t => {
  for (const kind of ['provider', 'builtin']) {
    const legacy = fixture(t, { unified: true })
    const ordinary = legacy.save(preset('unused', 'Ordinary legacy preset'))
    const conflicting = legacy.save(preset('unused', 'Conflicting legacy preset'))
    legacy.apply('legacy-session', ordinary.id)
    const store = fixture(t, { unified: true, ...(kind === 'builtin' ? { builtins: [...BUILTINS, { ...conflicting, name: 'Registered catalog entry' }] } : {}) })
    if (kind === 'provider') {
      store.registerPresets({ pluginId: 'example', presets: [{ ...conflicting, name: 'Registered catalog entry' }] })
      store.save(preset('unused', 'Existing local preset'))
    }
    const before = structuredClone(store.state), catalog = store.list(), sourceFile = readFileSync(legacy.path)
    const ownFile = existsSync(store.path) ? readFileSync(store.path) : null
    assert.throws(() => store.migrateLegacy(dirname(legacy.path)), { name: 'TypeError', message: `Duplicate assembly preset: ${conflicting.id}` })
    assert.deepEqual(store.state, before); assert.deepEqual(store.list(), catalog)
    assert.equal(store.hasSelection('legacy-session'), false)
    assert.throws(() => store.get(ordinary.id), { status: 404 })
    assert.equal(existsSync(store.path), ownFile !== null)
    if (ownFile !== null) assert.deepEqual(readFileSync(store.path), ownFile)
    assert.deepEqual(readFileSync(legacy.path), sourceFile)
    assert.throws(() => store.save(conflicting, conflicting.id), /Copy a built-in/)
    assert.throws(() => store.remove(conflicting.id), /Built-in presets/)
  }
})

test('legacy selection snapshots can share registered IDs and existing local presets still take precedence', t => {
  const legacy = fixture(t, { unified: true }), localPreset = legacy.save(preset('unused', 'Legacy version'))
  const store = fixture(t, { unified: true })
  store.migrateLegacy(dirname(legacy.path))
  store.save({ ...localPreset, name: 'Local version' }, localPreset.id)
  store.registerPresets({ pluginId: 'example', presets: [preset('provider-policy')] })
  legacy.applySnapshot('provider-session', preset('provider-policy', 'Legacy provider snapshot'))
  legacy.applySnapshot('builtin-session', preset('builtin-native', 'Legacy built-in snapshot'))
  const additional = legacy.save(preset('unused', 'Additional legacy preset'))
  const sourceFile = readFileSync(legacy.path)
  assert.equal(store.migrateLegacy(dirname(legacy.path)), true)
  assert.equal(store.get(localPreset.id).name, 'Local version')
  assert.equal(store.get(additional.id).name, 'Additional legacy preset')
  assert.equal(store.selection('provider-session').name, 'Legacy provider snapshot')
  assert.equal(store.selection('builtin-session').name, 'Legacy built-in snapshot')
  assert.equal(store.get('provider-policy').builtin, true)
  assert.deepEqual(readFileSync(legacy.path), sourceFile)
})
