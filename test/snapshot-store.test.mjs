import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AssemblyPresetStore } from '../src/store.js'
test('draft snapshots are detached from the library, validated and durable', t => {
  const directory = mkdtempSync(join(tmpdir(), 'assembler-snapshot-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const store = new AssemblyPresetStore(directory, { unified: true }), preset = store.get('builtin-native'), before = store.list()
  store.applySnapshot('session-draft', { ...preset, name: 'Detached draft' })
  assert.equal(store.selection('session-draft').name, 'Detached draft'); assert.deepEqual(store.list(), before)
  assert.equal(new AssemblyPresetStore(directory, { unified: true }).selection('session-draft').name, 'Detached draft')
  assert.throws(() => store.applySnapshot('__proto__', preset)); assert.throws(() => store.applySnapshot('other', { ...preset, id: '' }))
  store.applySnapshot('session-draft', null); assert.equal(store.selection('session-draft'), null)
})
