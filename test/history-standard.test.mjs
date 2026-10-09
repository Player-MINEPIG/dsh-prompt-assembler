import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { historyHost } from './history-fixture.test.mjs'
import { DEFAULT_HISTORY_POLICY } from '../src/history-policy.js'
const root = process.env.DSH_ASSEMBLER_STOCK_ROOT
const clean = () => ({ ...structuredClone(DEFAULT_HISTORY_POLICY), enabled: true })
const text = m => m.content.filter(b => b.type === 'text').map(b => b.text).join('')
const hidden = session => session.snapshotEvents().filter(e => e.data.historyPolicy?.action === 'hide')
const user = (h, value, kind = 'dsh-prompt-assembler') => h.llm.createUserMessage({ content: [{ type: 'text', text: value }], source: { kind } })
const inject = (h, value, kind) => h.agent.session.append('user/message', user(h, value, kind), { surfaceOp: 'append' })
async function fixture(run, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'history-standard-'))
  const h = await historyHost({ root, directory, advanced: false, standard: true, ...options })
  try { await run(h, directory) } finally { await h.dispose(); rmSync(directory, { recursive: true, force: true }) }
}
function presets(h) {
  return h.ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (decision.kind !== 'enter') return decision
    return { ...decision, messages: [user(h, `PRE ${payload.turn} A`), user(h, `PRE ${payload.turn} B`), ...decision.messages, user(h, `POST ${payload.turn}`)] }
  })
}
test('stock three-turn product path keeps two human/assistant pairs and only third-turn presets; source equality never deletes human', { skip: !root }, () => fixture(async h => {
  assert.equal(h.ctx.agentLoop.requestAssemblyVersion, undefined)
  h.store.save('history', clean(), 0); presets(h)
  await h.turn('PRE 1 A'); await h.turn('SECOND HUMAN')
  const before = JSON.parse(JSON.stringify(h.agent.session.snapshotEvents()))
  const assistants = before.filter(e => e.type === 'assistant/message').map(e => e.data.message)
  await h.turn('THIRD HUMAN')
  const request = h.requests.at(-1)
  assert.deepEqual(request.filter(m => m.role === 'user').map(text), ['PRE 1 A', 'SECOND HUMAN', 'PRE 3 A', 'PRE 3 B', 'THIRD HUMAN', 'POST 3'])
  assert.deepEqual(request.filter(m => m.role === 'assistant'), assistants)
  assert.ok(assistants.every(m => m.content.some(b => b.type === 'reasoning') && text(m).includes('UpdateVariable')))
  assert.deepEqual(h.agent.session.snapshotEvents().slice(0, before.length), before)
  assert.equal(hidden(h.agent.session).length, 6)
  assert.ok(hidden(h.agent.session).every(e => e.sourceEventSeqs.includes(e.data.historyPolicy.originalSeq)))
  assert.deepEqual(request.filter(m => m.role !== 'system').map(m => m.role), ['user', 'assistant', 'user', 'assistant', 'user', 'user', 'user', 'user'])
}))
test('standard controls preview, preserve advanced options, restore at original positions, and avoid redundant replacement events', { skip: !root }, () => fixture(async h => {
  h.store.save('history', clean(), 0)
  const original = inject(h, 'PLUGIN')
  await h.turn('ONE'); await h.turn('TWO')
  assert.equal(hidden(h.agent.session).length, 1)
  await h.turn('THREE'); assert.equal(hidden(h.agent.session).length, 1)
  const policy = { ...clean(), sources: clean().sources.map(r => ({ ...r, include: true })) }
  const preview = await h.service.preview('history', policy)
  assert.equal(preview.preview.find(r => r.messageId === original.data.id).action, 'restore')
  h.service.save('history', policy, 1); await h.turn('FOUR')
  assert.equal(h.requests.at(-1).filter(m => m.id === original.data.id).length, 1)
  assert.ok(h.requests.at(-1).findIndex(m => m.id === original.data.id) < h.requests.at(-1).findIndex(m => text(m) === 'ONE'))
  h.service.save('history', clean(), 2); await h.turn('FIVE'); assert.equal(hidden(h.agent.session).length, 2)
  h.service.save('history', { ...clean(), enabled: false }, 3); await h.turn('SIX'); await h.turn('SEVEN')
  assert.equal(h.requests.at(-1).filter(m => m.id === original.data.id).length, 1)
  assert.equal(hidden(h.agent.session).length, 2)
  assert.throws(() => h.service.save('history', { ...clean(), contentTypes: { text: false, image: true, reasoning: false } }, 4), /require advanced/)
}))
test('latest runtime context reuse, unsent tail, current direct/pre-step injections, and unknown sources are retained', { skip: !root }, () => fixture(async h => {
  h.store.save('history', clean(), 0)
  let contextText = 'OLD CONTEXT'
  h.ctx.systemPrompt.context({ name: 'history-test-context', order: 100, text: () => contextText })
  inject(h, 'UNKNOWN', 'unregistered-producer')
  await h.turn('ZERO'); contextText = 'NEW CONTEXT'; await h.turn('ONE')
  const fresh = inject(h, 'UNSENT TAIL'); let current
  const stop = h.ctx.on('agent/pre-step', async (_, next) => { current = inject(h, 'DIRECT CURRENT'); return next() })
  await h.turn('TWO'); stop()
  const request = h.requests.at(-1)
  assert.ok(!request.some(m => text(m).endsWith('OLD CONTEXT')))
  assert.ok(['NEW CONTEXT', 'UNKNOWN', 'UNSENT TAIL', 'DIRECT CURRENT'].every(v => request.some(m => text(m).endsWith(v))), JSON.stringify(request.map(m => [m.source.kind, text(m)])))
  const preview = await h.service.preview('history'); assert.ok(preview.audit.warnings.some(w => w.code === 'UNKNOWN_SOURCE_RETAINED'))
  await h.turn('THREE'); assert.ok(!h.requests.at(-1).some(m => [fresh.data.id, current.data.id].includes(m.id)))
  contextText = 'LATEST CONTEXT'
  await h.turn('FOUR')
  assert.ok(!h.requests.at(-1).some(m => text(m).endsWith('NEW CONTEXT')))
  assert.ok(h.requests.at(-1).some(m => text(m).endsWith('LATEST CONTEXT')))
}))
test('standard keeps complete tools and assistants even with exclusion rules for human/model/tool', { skip: !root }, () => fixture(async h => {
  h.store.save('history', { ...clean(), sources: [...clean().sources, { kind: 'user', include: false }, { kind: 'model', include: false }] }, 0)
  inject(h, 'PLUGIN'); await h.turn('USE TOOL')
  assert.ok(h.requests.length >= 2)
  const request = h.requests[1], call = request.findIndex(m => m.content.some(b => b.type === 'tool-call'))
  assert.ok(call >= 0); assert.equal(request[call + 1].role, 'tool'); assert.equal(text(request[call + 1]), 'FIXTURE RESULT')
  assert.ok(request[call].content.some(b => b.type === 'reasoning'))
  assert.ok(request.some(m => text(m) === 'USE TOOL')); assert.ok(!request.some(m => text(m) === 'PLUGIN'))
}, { withTools: true }))
test('standard retry pins an already-cleaned surface; save during retry restores next step', { skip: !root }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'history-standard-retry-')); let h
  try {
    h = await historyHost({ root, directory, advanced: false, standard: true })
    h.store.save('history', clean(), 0); inject(h, 'PLUGIN'); await h.turn('ONE')
    const seed = JSON.parse(JSON.stringify(h.agent.session.snapshotEvents()))
    await h.dispose()
    h = await historyHost({ root, directory, seed, advanced: false, standard: true, retryOnce: true,
      onRetry: () => h.store.save('history', { ...clean(), enabled: false }, 1) })
    await h.turn('RETRY')
    assert.deepEqual(h.requests[0], h.requests[1]); assert.equal(hidden(h.agent.session).length, 1)
    assert.ok(!h.requests[0].some(m => text(m) === 'PLUGIN'))
    await h.turn('NEW STEP'); assert.ok(h.requests.at(-1).some(m => text(m) === 'PLUGIN'))
    assert.equal(hidden(h.agent.session).length, 1)
  } finally { await h?.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
test('disk replay, default-disabled fork restoration, compaction, and no-plugin stock continuation', { skip: !root }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'history-standard-restart-')); let h
  try {
    h = await historyHost({ root, directory, advanced: false, standard: true })
    h.store.save('history', clean(), 0); inject(h, 'PLUGIN'); await h.turn('ONE'); await h.turn('TWO')
    const path = join(directory, 'events.json'); writeFileSync(path, JSON.stringify(h.agent.session.snapshotEvents()))
    await h.dispose(); h = await historyHost({ root, directory, seed: JSON.parse(readFileSync(path)), advanced: false, standard: true })
    await h.turn('RESTART'); assert.equal(hidden(h.agent.session).length, 1)
    const child = h.ctx.sessions.fork(h.agent.session, undefined, 'child')
    const forkAgent = (await h.ctx.agents.create({ sessionId: 'child-live', seed: child.snapshotEvents(), agentOptions: { provider: 'offline', model: 'offline' } })).agent
    forkAgent.followup(user(h, 'CHILD INPUT', 'user')); await forkAgent.whenIdle()
    assert.ok(forkAgent.session.deriveMessages().some(m => text(m) === 'PLUGIN'))
    assert.ok(!h.agent.session.deriveMessages().some(m => text(m) === 'PLUGIN'))
    const session = h.agent.session, nodes = [...session.surface.nodes].filter(seq => seq > 0)
    session.append('user/message', user(h, 'COMPACTION SUMMARY', 'compaction'), { surfaceOp: { op: 'replace', startSeq: nodes[0], endSeq: nodes.at(-1) }, sourceEventSeqs: nodes })
    h.store.save('history', { ...clean(), enabled: false }, 1); await h.turn('DISABLED AFTER COMPACTION')
    assert.ok(h.requests.at(-1).some(m => text(m) === 'COMPACTION SUMMARY')); assert.ok(!h.requests.at(-1).some(m => text(m) === 'PLUGIN'))
    const seed = JSON.parse(readFileSync(path))
    await h.dispose(); h = await historyHost({ root, directory, seed, advanced: false }); await h.turn('PLUGIN REMOVED')
    assert.ok(!h.requests.at(-1).some(m => text(m) === 'PLUGIN'))
    assert.ok(h.requests.at(-1).filter(m => m.role === 'assistant').every(m => m.content.some(b => b.type === 'reasoning')))
    assert.deepEqual(h.errors, [])
  } finally { await h?.dispose(); rmSync(directory, { recursive: true, force: true }) }
})


test('backend switch restores standard tombstones; rejected steps cannot change history', { skip: !root }, async () => {
  let standard = true
  await fixture(async h => {
    h.store.save('history', clean(), 0); inject(h, 'PLUGIN'); await h.turn('ONE'); await h.turn('TWO')
    assert.ok(!h.agent.session.deriveMessages().some(m => text(m) === 'PLUGIN'))
    standard = false
    const before = h.agent.session.surface.nodes.slice()
    const reject = h.ctx.on('agent/pre-step', async () => ({ kind: 'reject', reason: 'fixture' }))
    await h.turn('REJECTED')
    assert.deepEqual(h.agent.session.surface.nodes, before); reject()
    await h.turn('ADVANCED SELECTION')
    assert.ok(h.requests.at(-1).some(m => text(m) === 'PLUGIN'))
    standard = true; await h.turn('STANDARD AGAIN')
    assert.ok(!h.requests.at(-1).some(m => text(m) === 'PLUGIN'))
    assert.equal(hidden(h.agent.session).length, 2)
  }, { standardActive: () => standard })
})

for (const advanced of [false, true]) test(`${advanced ? 'core' : 'stock'}: runtime and system history switches keep only current contributions across turns and restart`, { skip: !(advanced ? process.env.DSH_ASSEMBLER_CORE_ROOT : root) }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'history-refresh-')); let h
  const options = { root: advanced ? process.env.DSH_ASSEMBLER_CORE_ROOT : root, directory, advanced, standard: !advanced }
  try {
    h = await historyHost(options)
    h.store.save('history', clean(), 0)
    h.ctx.systemPrompt.context({ name: 'refresh-fixture', order: 100, text: 'UNCHANGED CONTEXT' })
    await h.turn('ONE')
    const first = h.requests.at(-1).find(m => m.source.kind === 'runtime-context')
    assert.ok(first)
    const preview = await h.service.preview('history')
    assert.equal(preview.preview.find(row => row.messageId === first.id).action, 'exclude')
    assert.ok(preview.preview.some(row => row.sourceKind === 'system-prompt' && row.action === 'exclude'))
    // Simulate an older surviving system revision; the next request must reconcile it.
    h.agent.session.append('system/message', { turn: 1, step: 1, message: h.llm.createSystemMessage('OBSOLETE SYSTEM') }, { surfaceOp: 'append' })
    for (const input of ['TWO', 'THREE']) {
      await h.turn(input)
      const req = h.requests.at(-1), contexts = req.filter(m => m.source.kind === 'runtime-context')
      assert.equal(contexts.length, 1)
      assert.notEqual(contexts[0].id, first.id)
      assert.ok(text(contexts[0]).endsWith('UNCHANGED CONTEXT'))
      assert.ok(req.findIndex(m => m.id === contexts[0].id) > req.findIndex(m => text(m) === input))
      assert.equal(req.filter(m => m.role === 'system').length, 1)
      assert.ok(!req.some(m => text(m) === 'OBSOLETE SYSTEM'))
    }
    const seed = structuredClone(h.agent.session.snapshotEvents())
    assert.ok(seed.some(e => e.type === 'user/message' && e.data.id === first.id), 'original log remains traceable')
    await h.dispose(); h = await historyHost({ ...options, seed })
    h.ctx.systemPrompt.context({ name: 'refresh-fixture', order: 100, text: 'UNCHANGED CONTEXT' })
    await h.turn('AFTER RESTART')
    assert.equal(h.requests.at(-1).filter(m => m.source.kind === 'runtime-context').length, 1)
    const keep = { ...clean(), sources: clean().sources.map(r => ['system-prompt', 'runtime-context'].includes(r.kind) ? { ...r, include: true } : r) }
    h.service.save('history', keep, 1)
    const kept = await h.service.preview('history')
    assert.ok(kept.preview.filter(row => row.sourceKind === 'runtime-context').every(row => ['keep', 'restore'].includes(row.action)))
    await h.turn('KEEP OLD COPIES')
    assert.ok(h.requests.at(-1).filter(m => m.source.kind === 'runtime-context').length > 1)
  } finally { await h?.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
