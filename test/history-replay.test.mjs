import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { compileFunction } from 'node:vm'
import { DEFAULT_HISTORY_POLICY, filterHistory } from '../src/history-policy.js'
const stock = process.env.DSH_ASSEMBLER_STOCK_ROOT

test('stock DeepSeek Messages serializer accepts edited text with unchanged thinking, signatures and replay alignment', { skip: !stock }, async () => {
  const require = createRequire(join(resolve(stock), 'package.json'))
  const code = readFileSync(require.resolve('@deepseek-ai/dsh-llm-deepseek'), 'utf8')
  const { LlmError } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-llm')))
  // Execute the actual shipped replay validator and assistant serialization function.
  // No network requests; this is adapter serialization acceptance, not server acceptance.
  const replayStart = code.indexOf('function object(value, code = "MALFORMED_RESPONSE")')
  const assistantStart = code.indexOf('function assistant(message, model, onReplayDegrade)')
  assert.ok(replayStart > 0 && assistantStart > replayStart)
  const replayCode = code.slice(replayStart, code.indexOf('//#endregion', replayStart))
  const assistantCode = code.slice(assistantStart, code.indexOf('/** Serialize one complete request', assistantStart))
  const serialize = compileFunction(`${replayCode}\n${assistantCode}\nreturn assistant`, ['LlmError', 'unsupported', 'toolInput'])(LlmError, type => { throw Error(type) }, JSON.parse)
  const message = { id: 'assistant', role: 'assistant', source: { kind: 'model', provider: 'fixture', model: 'deepseek-fixture', replayState: { response: { kind: 'deepseek-messages', version: 1, model: 'deepseek-fixture' }, blocks: [{ type: 'reasoning', signature: 'UNMODIFIED SIGNATURE' }, { type: 'text' }] } }, content: [{ type: 'reasoning', text: 'UNCHANGED REASONING' }, { type: 'text', text: 'Before.\n<UpdateVariable>\nfixture\n</UpdateVariable>\nAfter.' }] }
  const before = structuredClone(message)
  const result = filterHistory({ messages: [message], events: [{ seq: 1, type: 'assistant/message', data: { message } }], policy: { ...structuredClone(DEFAULT_HISTORY_POLICY), enabled: true, fragments: [{ id: 'mvu', sourceKind: 'model', start: '<UpdateVariable>', end: '</UpdateVariable>', mode: 'lines', enabled: true }] }, reasoningSafety: { canOmit: true, contract: 'even-an-allow-cannot-remove-replay' } })
  assert.deepEqual(message, before)
  assert.deepEqual(result.messages[0].source, message.source)
  assert.deepEqual(result.messages[0].content[0], message.content[0])
  const degraded = []
  assert.deepEqual(serialize(result.messages[0], 'deepseek-fixture', reason => degraded.push(reason)), [{ type: 'thinking', thinking: 'UNCHANGED REASONING', signature: 'UNMODIFIED SIGNATURE' }, { type: 'text', text: 'Before.\nAfter.' }])
  assert.deepEqual(degraded, [])
  const unknown = structuredClone(message); unknown.source.replayState.response.version = 2
  const retained = filterHistory({ messages: [unknown], events: [{ seq: 1, type: 'assistant/message', data: { message: unknown } }], policy: result.audit.policy })
  assert.deepEqual(retained.messages, [unknown])
})
