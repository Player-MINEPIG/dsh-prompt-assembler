import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { historyHost } from './history-fixture.test.mjs'
import { DEFAULT_HISTORY_POLICY } from '../src/history-policy.js'

const root = process.env.DSH_ASSEMBLER_CORE_ROOT
const stock = process.env.DSH_ASSEMBLER_STOCK_ROOT
const clean = () => ({ ...structuredClone(DEFAULT_HISTORY_POLICY), enabled: true, fragments: [{ id: 'mvu', sourceKind: 'model', start: '<UpdateVariable>', end: '</UpdateVariable>', mode: 'lines', enabled: true }] })
const text = m => m.content.filter(b => b.type === 'text').map(b => b.text).join('')

test('advanced Host filters copies, records exact requests, edits rules, forks, restarts, and continues after unload', { skip: !root, timeout: 20000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'history-host-')); let h
  try {
    h = await historyHost({ root, directory })
    h.store.save('history', clean(), 0)
    const session = h.agent.session
    const injection = session.append('user/message', h.llm.createUserMessage({ content: [{ type: 'text', text: 'IDENTICAL' }], source: { kind: 'dsh-prompt-assembler', form: 'instructions' } }), { surfaceOp: 'append' })
    await h.turn('IDENTICAL')
    const assistant = session.snapshotEvents().find(e => e.type === 'assistant/message')
    await h.turn('NEXT')
    let sent = h.requests.at(-1)
    assert.equal(sent.filter(m => text(m) === 'IDENTICAL').length, 1)
    assert.equal(sent.filter(m => text(m) === 'CURRENT PRESET').length, 1)
    assert.equal(sent.find(m => m.id === assistant.data.message.id).content.some(b => b.type === 'reasoning'), false)
    assert.equal(text(sent.find(m => m.id === assistant.data.message.id)), 'The door opens.\nYou enter.')
    assert.equal(session.eventAt(injection.seq), injection)
    assert.equal(text(session.eventAt(assistant.seq).data.message), h.body)
    const record = session.snapshotEvents().findLast(e => e.type === 'request/assembly')
    assert.deepEqual(record.data.messages, sent)
    assert.equal(record.data.metadata.historyPolicy.revision, 1)
    assert.ok(record.data.metadata.historyPolicy.decisions.some(d => d.action === 'edit'))
    const preservedRecord = JSON.stringify(record)
    h.store.save('history', { ...clean(), fragments: [] }, 1)
    await h.turn('CHANGED')
    assert.match(text(h.requests.at(-1).find(m => m.id === assistant.data.message.id)), /UpdateVariable/)
    assert.equal(JSON.stringify(record), preservedRecord)
    const child = h.ctx.sessions.fork(session, undefined, 'child')
    assert.equal(h.store.get('child').policy.enabled, false)
    assert.ok(child.deriveMessages().some(m => text(m).includes('UpdateVariable')))
    // Persist real events, dispose the entire Host, and resume a fresh Host from disk.
    const logPath = join(directory, 'session.json'); writeFileSync(logPath, JSON.stringify(session.snapshotEvents()))
    await h.dispose(); h = await historyHost({ root, directory, seed: JSON.parse(readFileSync(logPath, 'utf8')) })
    assert.equal(h.store.get('history').revision, 2)
    await h.turn('AFTER RESTART')
    assert.equal(h.agent.session.snapshotEvents().findLast(e => e.type === 'request/assembly').data.metadata.historyPolicy.revision, 2)
    h.store.save('history', { ...clean(), enabled: false }, 2)
    await h.turn('DISABLED')
    assert.equal(h.requests.at(-1).filter(m => text(m) === 'IDENTICAL').length, 2)
    await h.stop(); await h.unmountAssembly(); await h.turn('UNLOADED')
    assert.ok(h.requests.at(-1).some(m => text(m).includes('UpdateVariable')))
    assert.equal(h.requests.at(-1).some(m => text(m) === 'CURRENT PRESET'), false)
    assert.deepEqual(h.errors, [])
  } finally { await h?.dispose(); rmSync(directory, { recursive: true, force: true }) }
})

test('real Host tool continuation retains complete call/result and reasoning while cleaning independent history', { skip: !root, timeout: 20000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'history-tools-')); let h
  try {
    h = await historyHost({ root, directory, withTools: true })
    h.store.save('history', clean(), 0)
    await h.turn('USE TOOL')
    assert.ok(h.requests.length >= 2)
    const request = h.requests[1], callIndex = request.findIndex(m => m.content.some(b => b.type === 'tool-call'))
    assert.ok(callIndex >= 0)
    assert.equal(request[callIndex + 1].role, 'tool')
    assert.equal(text(request[callIndex + 1]), 'FIXTURE RESULT')
    assert.ok(request[callIndex].content.some(b => b.type === 'reasoning'))
    await h.turn('NEXT TURN')
    assert.ok(h.requests.at(-1).filter(m => m.role === 'assistant').every(m => m.content.some(b => b.type === 'reasoning')))
    assert.deepEqual(h.errors, [])
  } finally { await h?.dispose(); rmSync(directory, { recursive: true, force: true }) }
})

test('retry reassembles current content; compaction surface is filtered without resurrecting shadowed messages', { skip: !root, timeout: 20000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'history-retry-')); let h
  try {
    h = await historyHost({ root, directory, retryOnce: true })
    h.store.save('history', clean(), 0)
    await h.turn('RETRY ME')
    assert.equal(h.requests.length, 2)
    assert.equal(h.requests[0].filter(m => text(m) === 'CURRENT PRESET').length, 1)
    assert.equal(h.requests[1].filter(m => text(m) === 'CURRENT PRESET').length, 1)
    const session = h.agent.session
    const nodes = [...session.surface.nodes].filter(seq => session.eventAt(seq).type !== 'system/message')
    session.append('user/message', h.llm.createUserMessage({ content: [{ type: 'text', text: 'COMPACTION SUMMARY' }], source: { kind: 'compaction' } }), {
      surfaceOp: { op: 'replace', startSeq: nodes[0], endSeq: nodes.at(-1) }, sourceEventSeqs: nodes,
    })
    await h.turn('AFTER COMPACTION')
    assert.ok(h.requests.at(-1).some(m => text(m) === 'COMPACTION SUMMARY'))
    assert.ok(!h.requests.at(-1).some(m => text(m) === 'RETRY ME'))
    assert.ok(session.snapshotEvents().findLast(e => e.type === 'request/assembly').data.metadata.historyPolicy.warnings.some(w => w.code === 'UNKNOWN_SOURCE_RETAINED'))
    assert.deepEqual(h.errors, [])
  } finally { await h?.dispose(); rmSync(directory, { recursive: true, force: true }) }
})

test('filtered advanced audit reopens and continues on unmodified stock Host without any history plugin', { skip: !root || !stock, timeout: 20000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'history-stock-')); let h
  try {
    h = await historyHost({ root, directory })
    h.store.save('history', clean(), 0)
    await h.turn('ORIGINAL HUMAN'); await h.turn('CLEANED')
    const seed = JSON.parse(JSON.stringify(h.agent.session.snapshotEvents()))
    const record = seed.findLast(e => e.type === 'request/assembly')
    assert.ok(record.data.messages.some(m => m.role === 'assistant' && text(m) === 'The door opens.\nYou enter.'))
    await h.dispose()
    h = await historyHost({ root: stock, directory, seed, advanced: false })
    assert.equal(h.ctx.agentLoop.requestAssemblyVersion, undefined)
    await h.turn('NATIVE CONTINUATION')
    assert.ok(h.requests.at(-1).some(m => m.role === 'assistant' && text(m).includes('UpdateVariable')))
    assert.deepEqual(h.agent.session.snapshotEvents().find(e => e.seq === record.seq), record)
  } finally { await h?.dispose(); rmSync(directory, { recursive: true, force: true }) }
})

test('a save during a failed attempt applies next step; retries keep the captured rule revision', { skip: !root, timeout: 20000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'history-step-policy-')); let h
  try {
    h = await historyHost({ root, directory, retryOnce: true, onRetry: () => h.store.save('history', { ...clean(), enabled: false }, 1) })
    h.store.save('history', clean(), 0)
    await h.turn('RETRY')
    const recorded = h.agent.session.snapshotEvents().filter(e => e.type === 'request/assembly')
    assert.equal(h.requests.length, 2)
    assert.ok(recorded.every(e => e.data.metadata.historyPolicy.revision === 1))
    await h.turn('NEW STEP')
    assert.equal(h.agent.session.snapshotEvents().findLast(e => e.type === 'request/assembly').data.metadata.historyPolicy.revision, 2)
  } finally { await h?.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
