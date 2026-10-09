import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {AssemblyPresetStore} from '../src/store.js'
import {HistoryPolicyStore} from '../src/history/store.js'
import {presetHistoryStore} from '../src/history/preset-store.js'
import {DEFAULT_HISTORY_POLICY} from '../src/history/schema.js'
import {BUILTINS, normalizePreset} from '../src/model.js'

test('history policies survive strategy import, save, application, copy and process reload; legacy fallback is preserved', () => {
  const dir = mkdtempSync(join(tmpdir(),'history-preset-'))
  try {
    let assembly = new AssemblyPresetStore(dir), legacy = new HistoryPolicyStore(dir)
    let history = presetHistoryStore(legacy, assembly)
    const clean = {...DEFAULT_HISTORY_POLICY, enabled:true}
    legacy.save('a', clean, 0)
    const old = assembly.save({...BUILTINS[0], name:'old'})
    assembly.apply('a',old.id)
    assert.equal(history.get('a').policy.enabled,true)
    const saved = assembly.save({...old, historyPolicy:DEFAULT_HISTORY_POLICY})
    assert.equal(history.get('a').policy.enabled,true)
    assembly.apply('a',saved.id)
    assert.equal(history.get('a').policy.enabled,false)
    assembly.save({...saved,historyPolicy:clean},saved.id)
    assert.equal(history.get('a').policy.enabled,false)
    assembly.copySelection('a','b')
    assembly = new AssemblyPresetStore(dir); history = presetHistoryStore(legacy,assembly)
    assert.equal(history.get('b').policy.enabled,false)
    assert.equal(assembly.get(saved.id).historyPolicy.enabled,true)
    assert.throws(()=>normalizePreset({...saved,historyPolicy:{...clean,enabled:'yes'}}),/boolean/)
    assembly.apply('a',null)
    assert.equal(history.get('a').policy.enabled,true)
  } finally {rmSync(dir,{recursive:true,force:true})}
})
