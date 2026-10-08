import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DEFAULT_HISTORY_POLICY, filterHistory, normalizeHistoryPolicy, matchHistoryFragments, HistoryPolicyStore } from '../src/history-policy.js'

const policy = changes => ({ ...structuredClone(DEFAULT_HISTORY_POLICY), enabled: true, ...changes })
const message = (id, role, kind, content) => ({ id, role, source: { kind }, content: typeof content === 'string' ? [{ type: 'text', text: content }] : content })
const events = messages => messages.map((m, seq) => ({ seq, type: m.role === 'tool' ? 'tool/result' : `${m.role}/message`, data: m.role === 'user' ? m : { message: m }, surfaceOp: 'append' }))
const run = (messages, options = {}) => filterHistory({ messages, events: events(messages), policy: policy(), reasoningSafety: { canOmit: true, contract: 'offline-fixture' }, ...options })

test('source-based cleaning preserves identical human text, roles, current injection and immutable audit inputs', () => {
  const messages = [message('p1', 'user', 'dsh-prompt-assembler', 'SAME'), message('u1', 'user', 'user', 'SAME'), message('a1', 'assistant', 'model', 'ANSWER'), message('p2', 'user', 'dsh-prompt-assembler', 'CURRENT'), message('u2', 'user', 'user', 'NEXT')]
  const before = structuredClone(messages), result = run(messages, { currentStepSeq: 3 })
  assert.deepEqual(result.messages.map(m => m.id), ['u1', 'a1', 'p2', 'u2'])
  assert.deepEqual(messages, before); assert.deepEqual(result.messages.map(m => m.role), ['user', 'assistant', 'user', 'user'])
  assert.equal(result.audit.decisions[0].seq, 0)
  assert.equal(result.audit.decisions[0].action, 'exclude')
})

test('unknown source and compacted summaries are retained with a visible fallback', () => {
  const result = run([message('x', 'user', 'future-plugin', 'SECRET'), message('c', 'user', 'compaction', 'SUMMARY')])
  assert.equal(result.messages.length, 2)
  assert.deepEqual(result.audit.warnings.map(w => w.code), ['UNKNOWN_SOURCE_RETAINED', 'UNKNOWN_SOURCE_RETAINED'])
})

test('unchanged active native context is retained while obsolete snapshots and injected tool user copies are excluded', () => {
  const messages = [message('old', 'user', 'runtime-context', 'OLD CONTEXT'), message('active', 'user', 'runtime-context', 'ACTIVE CONTEXT'), message('injected', 'user', 'tool', 'OLD INJECTED COPY'), message('u', 'user', 'user', 'HI')]
  const result = run(messages)
  assert.deepEqual(result.messages.map(m => m.id), ['active', 'u'])
  assert.deepEqual(result.audit.decisions[1].reasons, ['CURRENT_RUNTIME_CONTEXT'])
})

const rule = { id: 'mvu', sourceKind: 'model', start: '<UpdateVariable>', end: '</UpdateVariable>', mode: 'lines', enabled: true }
test('fragment preview reports exact original offsets and retains surrounding RP text and raw reasoning evidence', () => {
  const text = 'Door opens.\n<UpdateVariable>\n<Analysis>fixture</Analysis>\n<JSONPatch>[]</JSONPatch>\n</UpdateVariable>\nYou enter.'
  const result = run([message('a', 'assistant', 'model', [{ type: 'reasoning', text: 'THOUGHT' }, { type: 'text', text }])], { policy: policy({ fragments: [rule] }) })
  assert.deepEqual(result.messages[0].content, [{ type: 'text', text: 'Door opens.\nYou enter.' }])
  assert.equal(result.preview[0].original.content[0].text, 'THOUGHT')
  const range = result.audit.decisions[0].blocks[1].ranges[0]
  assert.equal(text.slice(range.start, range.end), '<UpdateVariable>\n<Analysis>fixture</Analysis>\n<JSONPatch>[]</JSONPatch>\n</UpdateVariable>\n')
})

test('default rules never match RP prose; quotes, code fences, malformed and nested markup remain', () => {
  for (const text of ['I think the Analysis is done.', 'He says "<UpdateVariable>nothing</UpdateVariable>".', '```xml\n<UpdateVariable>\nexample\n</UpdateVariable>\n```', '<UpdateVariable>\nmissing end', '<UpdateVariable>\n<UpdateVariable>\nx\n</UpdateVariable>\n</UpdateVariable>']) {
    const result = run([message('a', 'assistant', 'model', text)], { policy: policy({ fragments: [rule] }) })
    assert.equal(result.messages[0].content[0].text, text)
  }
  assert.equal(matchHistoryFragments('<UpdateVariable>\nx', rule).warning, 'UNCLOSED_FRAGMENT')
  assert.equal(matchHistoryFragments('</UpdateVariable>', rule).warning, 'AMBIGUOUS_FRAGMENT')
})

test('inline literal removal is explicit; overlapping rules use original offsets', () => {
  const text = 'before <x>remove <y>also</y></x> after'
  const fragments = [{ ...rule, id: 'x', start: '<x>', end: '</x>', mode: 'literal' }, { ...rule, id: 'y', start: '<y>', end: '</y>', mode: 'literal' }]
  const result = run([message('a', 'assistant', 'model', text)], { policy: policy({ fragments }) })
  assert.equal(result.messages[0].content[0].text, 'before  after')
  assert.equal(result.audit.decisions[0].blocks[0].ranges.length, 1)
})

test('reasoning omission requires a verified contract and never overrides tools or opaque replay', () => {
  const a = message('a', 'assistant', 'model', [{ type: 'reasoning', text: 'REQUIRED' }, { type: 'text', text: 'ANSWER' }])
  for (const reasoningSafety of [null, { canOmit: true }, { canOmit: true, contract: 'deepseek-no-tools', toolsPresent: true }]) {
    assert.deepEqual(run([a], { reasoningSafety }).messages, [a])
  }
  const replay = { ...a, source: { ...a.source, replayState: { opaque: 'token' } } }
  assert.deepEqual(run([replay]).messages, [replay])
  const calls = message('calls', 'assistant', 'model', [{ type: 'reasoning', text: 'TOOL THOUGHT' }, { type: 'tool-call', id: 'call', name: 'fixture', input: {} }])
  const tool = { ...message('result', 'tool', 'tool', 'RESULT'), toolCallId: 'call' }
  assert.deepEqual(run([a, calls, tool]).messages, [a, calls, tool])
  assert.deepEqual(run([a], { policy: policy({ sources: [{ kind: 'model', include: false }] }), reasoningSafety: null }).messages, [a])
})

test('disable restores original effective surface; revisions apply retroactively without mutating audit', () => {
  const messages = [message('p', 'user', 'dsh-prompt-assembler', 'OLD'), message('u', 'user', 'user', 'HI')]
  const cleaned = run(messages), disabled = run(messages, { policy: policy({ enabled: false }) })
  assert.equal(cleaned.messages.length, 1); assert.deepEqual(disabled.messages, messages)
  assert.equal(cleaned.audit.policy.enabled, true); assert.equal(disabled.audit.policy.enabled, false)
})

test('strict config validation and revisioned atomic persistence survive restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'history-policy-'))
  try {
    const store = new HistoryPolicyStore(directory)
    assert.equal(store.get('one').revision, 0)
    store.save('one', policy({ fragments: [rule] }), 0)
    const reopened = new HistoryPolicyStore(directory)
    assert.deepEqual(reopened.get('one'), store.get('one'))
    assert.throws(() => reopened.save('one', policy(), 0), /reload/)
    const disabled = reopened.save('one', policy({ enabled: false }), 1)
    assert.equal(disabled.revision, 2)
    assert.equal(reopened.get('child').policy.enabled, false, 'fork has independent opt-in configuration')
    assert.throws(() => normalizeHistoryPolicy(policy({ surprise: true })), /Unknown/)
    assert.throws(() => normalizeHistoryPolicy(policy({ fragments: [{ ...rule, start: '' }] })), /delimiters/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
