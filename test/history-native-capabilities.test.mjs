import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Compatibility reproductions, deliberately not a production policy implementation.
// Every model response is synthetic; no provider connection or real profile is used.
const root = process.env.DSH_ASSEMBLER_STOCK_ROOT
const text = message => message.content.filter(b => b.type === 'text').map(b => b.text).join('')

async function host(run) {
  const require = createRequire(join(resolve(root), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)))
  assert.equal(require('@deepseek-ai/dsh-session/package.json').version, '0.2.0-rc.2')
  const { Context } = await load('cordis'), llm = await load('dsh-llm')
  const { SystemPrompt } = await load('dsh-system-prompt')
  const sessionModule = await load('dsh-session')
  const ctx = new Context(), requests = [], errors = []
  try {
    await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false, personaPrefix: 'FIXTURE' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) {
      await ctx.plugin((await load(`dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    }
    ctx.on('agent/error', event => errors.push(event.error))
    class Offline extends llm.LlmAdapter {
      async resolveModel(provider, id) { return { provider, id, name: id } }
      async *stream(request) {
        assert.deepEqual(request.messages, ctx.sessions.get(request.sessionId).deriveMessages())
        requests.push(structuredClone(request.messages))
        for (const [index, block] of [
          { type: 'reasoning', text: 'SYNTHETIC REASONING' },
          { type: 'text', text: 'The door opens. <UpdateVariable><Analysis>fixture</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable> You enter.' },
        ].entries()) {
          yield { type: 'block-start', index, blockType: block.type }
          yield { type: `${block.type}-delta`, index, text: block.text }
          yield { type: 'block-end', index, block }
        }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    ctx.llm.registerAdapter(['offline'], new Offline())
    const agent = (await ctx.agents.create({ sessionId: 'history-fixture', agentOptions: { provider: 'offline', model: 'offline' } })).agent
    const turn = async value => {
      agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: value }], source: { kind: 'user' } }))
      await agent.whenIdle()
      assert.deepEqual(errors, [])
    }
    await run({ ctx, llm, agent, session: agent.session, requests, turn, sessionModule })
  } finally { await ctx.fiber.dispose() }
}

test('native empty-system replacement hides only selected old injection, preserves original roles and audit', { skip: !root }, () => host(async ({ llm, session, requests, turn, ctx, sessionModule }) => {
  await turn('FIRST')
  const injected = session.append('user/message', llm.createUserMessage({
    content: [{ type: 'text', text: 'IDENTICAL TEXT' }], source: { kind: 'dsh-prompt-assembler', form: 'instructions' },
  }), { surfaceOp: 'append' })
  await turn('IDENTICAL TEXT')
  assert.equal(requests.at(-1).filter(m => text(m) === 'IDENTICAL TEXT').length, 2)
  const before = session.snapshotEvents()
  const hidden = session.append('system/message', { turn: 2, step: 1, message: llm.createSystemMessage('') }, {
    surfaceOp: { op: 'replace', startSeq: injected.seq, endSeq: injected.seq }, sourceEventSeqs: [injected.seq],
  })
  assert.deepEqual(session.snapshotEvents().slice(0, before.length), before)
  session.append('user/message', llm.createUserMessage({
    content: [{ type: 'text', text: 'CURRENT INJECTION' }], source: { kind: 'dsh-prompt-assembler', form: 'instructions' },
  }), { surfaceOp: 'append' })
  await turn('THIRD')
  const sent = requests.at(-1)
  assert.deepEqual(sent.filter(m => text(m) === 'IDENTICAL TEXT').map(m => m.source.kind), ['user'])
  assert.equal(sent.filter(m => text(m) === 'CURRENT INJECTION').length, 1)
  assert.deepEqual(sent.filter(m => ['user', 'assistant'].includes(m.role)).map(m => m.role), ['user', 'assistant', 'user', 'assistant', 'user', 'user'])
  const fork = ctx.sessions.fork(session, undefined, 'history-child')
  assert.deepEqual(fork.deriveMessages(), session.deriveMessages())
  // JSON replay uses the public Session constructor; this is not disk Host restart acceptance.
  const restored = sessionModule.Session.create('history-replay', JSON.parse(JSON.stringify(session.snapshotEvents())))
  assert.deepEqual(restored.deriveMessages(), session.deriveMessages())
  // An explicit user-message replacement can restore this original injection.
  session.append('user/message', injected.data, {
    surfaceOp: { op: 'replace', startSeq: hidden.seq, endSeq: hidden.seq }, sourceEventSeqs: [hidden.seq, injected.seq],
  })
  assert.equal(session.deriveMessages().filter(m => text(m) === 'IDENTICAL TEXT').length, 2)
  await turn('FOURTH')
  assert.equal(requests.at(-1).filter(m => text(m) === 'IDENTICAL TEXT').length, 2)
}))

test('assistant surface replacement is rejected with and without sourceEventSeqs', { skip: !root }, () => host(async ({ session, turn }) => {
  await turn('FIRST')
  const original = session.snapshotEvents().find(e => e.type === 'assistant/message')
  const changed = structuredClone(original.data)
  changed.message.content = [{ type: 'text', text: 'The door opens.  You enter.' }]
  const before = session.snapshotEvents(), messages = session.deriveMessages()
  const surfaceOp = { op: 'replace', startSeq: original.seq, endSeq: original.seq }
  assert.throws(() => session.append('assistant/message', changed, { surfaceOp }), /sourceEventSeqs must include every shadowed surface node/)
  assert.throws(() => session.append('assistant/message', changed, { surfaceOp, sourceEventSeqs: [original.seq] }), /assistant\/message embeds its source stream and cannot carry sourceEventSeqs/)
  assert.deepEqual(session.snapshotEvents(), before)
  assert.deepEqual(session.deriveMessages(), messages)
}))

test('custom projection edits assistant content but unload blocks cached reads and future append', { skip: !root }, () => host(async ({ ctx, session, turn }) => {
  await turn('FIRST')
  const original = session.snapshotEvents().find(e => e.type === 'assistant/message')
  let unregister
  const handle = ctx.plugin({ inject: ['sessions'], apply(context) {
    unregister = context.sessions.registerMessageProjection({ type: 'history-fixture/edit', project(event) {
      return new Map([[event.data.seq, event.data.message]])
    } })
  } })
  await handle
  const edited = { ...original.data.message, content: [{ type: 'text', text: 'The door opens.  You enter.' }] }
  session.append('history-fixture/edit', { seq: original.seq, message: edited })
  assert.equal(text(session.deriveMessages().find(m => m.id === edited.id)), 'The door opens.  You enter.')
  assert.equal(session.eventAt(original.seq), original)
  await unregister()
  assert.throws(() => session.deriveMessages(), /message projection.*removed or replaced/)
  assert.throws(() => session.append('session/title', { title: 'Continued' }), /message projection.*removed or replaced/)
  await handle.dispose()
}))

test('empty projected user content is still a message, not a deletion', { skip: !root }, () => host(async ({ ctx, session, turn }) => {
  await turn('FIRST')
  const original = session.snapshotEvents().find(e => e.type === 'user/message')
  await ctx.plugin({ inject: ['sessions'], apply(context) {
    context.sessions.registerMessageProjection({ type: 'history-fixture/empty', project() {
      return new Map([[original.seq, { ...original.data, content: [] }]])
    } })
  } })
  const count = session.deriveMessages().length
  session.append('history-fixture/empty', {})
  assert.equal(session.deriveMessages().length, count)
  assert.deepEqual(session.deriveMessages().find(m => m.id === original.data.id).content, [])
}))

test('built-in image offload cannot be used as a general assistant text editor', { skip: !root }, () => host(async ({ ctx, session, turn }) => {
  await turn('FIRST')
  const require = createRequire(join(resolve(root), 'package.json'))
  const offload = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-compaction-image-offload')))
  await ctx.plugin(offload)
  const original = session.snapshotEvents().find(e => e.type === 'assistant/message')
  assert.throws(() => session.append('image/offload', { targets: [{ seq: original.seq, imageIndexes: [0] }] }), /must be user\/message or tool\/result/)
}))
