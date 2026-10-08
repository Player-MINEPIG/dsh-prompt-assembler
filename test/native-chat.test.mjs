import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { compileFunction } from 'node:vm'
import { assembleNative } from '../src/native-backend.js'
import { createDefaultRegistry, NATIVE_BUILTINS } from '../adapters/tavern.js'

const stock = process.env.DSH_ASSEMBLER_STOCK_ROOT
test('stock rc.2 Chat hides assembler pre-step context but retains identical human text and durable messages', { skip: !stock }, async () => {
  const require = createRequire(join(resolve(stock), 'package.json'))
  const bundle = readFileSync(require.resolve('@deepseek-ai/dsh-client-ui-chat/client'), 'utf8')
  // Execute the shipped classifier and visibility predicate, not a local copy.
  // These region boundaries are specific to the supported rc.2 compatibility fixture.
  const region = name => {
    const marker = `//#region lib/types/client/${name}.js`, start = bundle.indexOf(marker)
    assert.notEqual(start, -1, `Missing stock Chat region: ${name}`)
    return bundle.slice(start + marker.length, bundle.indexOf('//#endregion', start))
  }
  const surface = await import(pathToFileURL(join(dirname(require.resolve('@deepseek-ai/dsh-session')), 'types/surface.js')))
  const nodeStart = bundle.indexOf('function contextLocation(context)')
  assert.notEqual(nodeStart, -1)
  const nodeCode = bundle.slice(nodeStart, bundle.indexOf('//#endregion', nodeStart))
  const chat = compileFunction([
    nodeCode, region('conversation-nodes/event-projection'), region('conversation-nodes/message'), region('contract/chat-visibility'),
    'return { messageDefinition, isVisibleChatNode }',
  ].join('\n'), ['isAppendSurfaceEvent', 'isReplacementSurfaceEvent'])(surface.isAppendSurfaceEvent, surface.isReplacementSurfaceEvent)
  const input = { id: 'human', role: 'user', content: [{ type: 'text', text: 'SAME TEXT' }], source: { kind: 'user' } }
  const runtime = { registry: createDefaultRegistry(), resources: { compile: () => ({ assemblyInput: { preset: { prompts: [{ identifier: 'wrapper', enabled: true, role: 'user', content: '{{history}}SAME TEXT{{input}}SAME TEXT' }] } } }) } }
  const plan = await assembleNative(runtime, { preset: NATIVE_BUILTINS.find(p => p.placement === 'native-slots'), inputs: [input], assembly: { sections: [], contexts: [], variables: {} }, preview: true })
  const messages = [...plan.beforeInput, input, ...plan.afterInput]
  const original = structuredClone(messages)
  const project = message => {
    const event = { type: 'user/message', seq: 5, time: 0, surfaceOp: 'append', data: message }
    const match = { event, role: 'start', location: { kind: 'unresolved' } }
    assert.ok(chat.messageDefinition.match(event))
    const context = { key: message.id, id: message.id, matches: [match], start: match }
    context.state = chat.messageDefinition.start(context, match, { previous: () => undefined })
    return chat.messageDefinition.buildViewNode(context)
  }
  for (const retained of [messages, JSON.parse(JSON.stringify(messages))]) {
    const nodes = retained.map(project)
    assert.deepEqual(nodes.map(n => n.kind), ['context', 'user', 'context'])
    assert.deepEqual(nodes.filter(chat.isVisibleChatNode).map(n => n.id), ['human'])
  }
  assert.deepEqual(messages, original, 'presentation leaves exact model-facing messages intact')
  assert.deepEqual(messages.map(m => m.role), ['user', 'user', 'user'])
  assert.ok(chat.isVisibleChatNode(project({ ...messages[0], source: { kind: 'user' } })), 'legacy user-marked records remain untouched')
})
