import test from 'node:test'
import assert from 'node:assert/strict'
import { actualAssemblyResult } from '../src/actual-result.js'
const msg = (id, text) => ({ id, role: 'assistant', content: [{ type: 'text', text }] })
test('actual request cards use filtered history while preserving authored source names and raw audit', () => {
  const old = msg('old', 'BODY + MVU'), injection = msg('injection', 'OLD PRESET'), current = msg('current', 'NEW PRESET')
  const history = { id: 'history', text: 'BODY + MVU', messages: [old, injection], source: { module: 'history' } }
  const named = { id: 'current-preset', name: 'Readable preset item', text: 'NEW PRESET', messages: [current] }
  const record = { messages: [msg('old', 'BODY'), current], metadata: { assembly: { nodes: [history, named] }, historyPolicy: { decisions: [{ messageId: 'old', action: 'edit' }, { messageId: 'injection', action: 'exclude' }] } } }
  const result = actualAssemblyResult(record)
  assert.equal(result.nodes[0].text, 'BODY'); assert.deepEqual(result.nodes[0].messages, [record.messages[0]])
  assert.equal(result.nodes[1], named); assert.equal(history.text, 'BODY + MVU')
  record.metadata.assembly.nodes = [{ ...history, messages: [injection] }, named]
  assert.deepEqual(actualAssemblyResult(record).nodes, [named])
})
