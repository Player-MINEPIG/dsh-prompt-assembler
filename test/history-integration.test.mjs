import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { Readable } from 'node:stream'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Run this file against an integration checkout before cherry-picking it there.
// No production module is patched. Host modules/providers are isolated per test.
const integrationRoot = resolve(process.env.DSH_HISTORY_INTEGRATION_ROOT ?? fileURLToPath(new URL('../', import.meta.url)))
const loadIntegration = path => import(pathToFileURL(join(integrationRoot, path)).href)
const text = message => message.content.filter(block => block.type === 'text').map(block => block.text).join('')
const body = 'Before.\n<UpdateVariable>\n{"fixture":true}\n</UpdateVariable>\nAfter.'
const json = value => JSON.parse(JSON.stringify(value))

async function invoke(handler, method, url, bodyValue, headers = {}) {
  const req = Readable.from(bodyValue === undefined ? [] : [Buffer.from(JSON.stringify(bodyValue))])
  Object.assign(req, { method, url, headers: { host: 'localhost:3112', ...(bodyValue === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, socket: { remoteAddress: '127.0.0.1' } })
  let responseBody = '', status = 200
  const responseHeaders = {}
  await handler(req, { get statusCode() { return status }, set statusCode(value) { status = value }, setHeader(name, value) { responseHeaders[name.toLowerCase()] = value }, end(value) { responseBody += value ?? '' } })
  return { status, headers: responseHeaders, body: responseBody ? JSON.parse(responseBody) : null }
}

async function host(root, withCore, run) {
  const require = createRequire(join(resolve(root), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)).href)
  const [{ Context }, { SystemPrompt }, llm, { default: plugin }, { BUILTINS }, { DEFAULT_HISTORY_POLICY }] = await Promise.all([
    load('cordis'), load('dsh-system-prompt'), load('dsh-llm'), loadIntegration('src/plugin.js'), loadIntegration('src/model.js'), loadIntegration('src/history-policy.js'),
  ])
  const ctx = new Context(), directory = mkdtempSync(join(tmpdir(), 'history-integrated-')), requests = [], errors = [], routes = []
  try {
    await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false, personaPrefix: 'INTEGRATION SYSTEM' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop', 'session-query', 'typert-registry']) {
      await ctx.plugin((await load(`dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    }
    // Mount the real public SessionController, not an inspect stub. Unused UI/file
    // capabilities are inert fixtures and cannot access native files or services.
    ctx.provide('agentDefaultModel', { currentSelection: () => ({ provider: 'offline', model: 'offline' }) })
    ctx.provide('attachments', { imageLimits: { maxImageBytes: 1024 } })
    ctx.provide('fileUploads', { registerAgentResolver: () => () => {} })
    ctx.provide('fs', {})
    ctx.provide('workspaceRegistry', { archivedSessionIds: [], list: () => [], get: () => undefined })
    await ctx.plugin((await load('dsh-api-session-controller')).SessionController, { nativeOpen: false })
    ctx.provide('webServer', { register(route) { routes.push(route); return () => { routes.splice(routes.indexOf(route), 1) } } })
    ctx.on('agent/error', event => errors.push(event.error))
    class Offline extends llm.LlmAdapter {
      async resolveModel(provider, id) { return { provider, id, name: id, systemPromptUpdate: 'in-history' } }
      async *stream(request) {
        requests.push(json(request.messages))
        for (const [index, block] of [{ type: 'reasoning', text: 'COMPLETE SYNTHETIC REASONING' }, { type: 'text', text: body }].entries()) {
          yield { type: 'block-start', index, blockType: block.type }
          yield { type: `${block.type}-delta`, index, text: block.text }
          yield { type: 'block-end', index, block }
        }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    ctx.llm.registerAdapter(['offline'], new Offline())
    const pluginHandle = ctx.plugin(plugin, { storageDir: directory }); await pluginHandle
    if (withCore) await ctx.plugin((await loadIntegration('core-extension/src/plugin.js')).default)
    const face = ctx.get('dshPromptAssembler')
    assert.ok(face.history, 'actual plugin entry must own history integration')
    assert.equal(ctx.agentLoop.requestAssemblyVersion === 1, withCore)
    assert.equal(routes.length, 1, 'assembly and history must share one secured HTTP registration')
    const handler = routes[0].handler, apiRoot = routes[0].path
    const historyRoot = `${apiRoot}/history-policy`, assemblyRoot = `${apiRoot}/assembly-presets`
    const tokenResponse = await invoke(handler, 'GET', `${apiRoot}/request-token`, undefined, { 'x-assembler-client': 'embedded' })
    assert.equal(tokenResponse.status, 200)
    assert.match(tokenResponse.body.token, /^[a-f0-9]{64}$/)
    const tokenHeaders = { 'x-assembler-request-token': tokenResponse.body.token }
    const call = (method, path, value, headers = tokenHeaders) => invoke(handler, method, path, value, headers)
    const historyUrl = `${historyRoot}?sessionId=combined`
    const agent = (await ctx.agents.create({ sessionId: 'combined', agentOptions: { provider: 'offline', model: 'offline' } })).agent
    const events = async () => (await ctx.sessionController.inspect(agent.id)).events
    const turn = async value => {
      agent.followup(llm.createUserMessage({ content: [{ type: 'text', text: value }], source: { kind: 'user' } }))
      await agent.whenIdle(); assert.deepEqual(errors, [])
    }
    const rules = [
      BUILTINS[0].rules[0], BUILTINS[0].rules[1],
      { id: 'pre-a', kind: 'dsh.text', role: 'user', inputMode: 'text', delivery: 'pre-step', text: 'PRE A' },
      { id: 'pre-b', kind: 'dsh.text', role: 'user', inputMode: 'text', delivery: 'pre-step', text: 'PRE B' },
      BUILTINS[0].rules[2],
      { id: 'post', kind: 'dsh.text', role: 'user', inputMode: 'text', delivery: 'pre-step', text: 'POST' },
    ]
    async function saveStrategy(backend) {
      const response = await call('POST', assemblyRoot, { ...BUILTINS[0], name: `History integration ${backend}`, backend, rules })
      assert.equal(response.status, 201, JSON.stringify(response.body))
      return response.body.preset.id
    }
    const nativeId = await saveStrategy('native'), coreId = await saveStrategy('core')
    const select = async id => {
      const response = await call('PUT', `${assemblyRoot}/selection`, { sessionId: agent.id, id })
      assert.equal(response.status, 200, JSON.stringify(response.body))
    }
    await select(nativeId)
    const initial = await call('GET', historyUrl)
    assert.equal(initial.status, 200); assert.equal(initial.body.capabilities.mode, 'standard')
    assert.equal((await call('GET', `${historyUrl}&mode=advanced`)).body.capabilities.fragmentFiltering, false)
    const policy = { ...json(DEFAULT_HISTORY_POLICY), enabled: true }
    assert.equal((await call('PUT', historyUrl, { policy, expectedRevision: 0 }, {})).status, 403, 'desktop mutation needs the shared token')
    assert.equal((await call('PUT', historyUrl, { policy, expectedRevision: 0 }, { ...tokenHeaders, origin: 'https://foreign.invalid' })).status, 403)
    const saved = await call('PUT', historyUrl, { policy, expectedRevision: 0 })
    assert.equal(saved.status, 200); assert.equal(saved.body.revision, 1)
    assert.equal(saved.headers['cache-control'], 'no-store')
    const unsupported = await call('PUT', `${historyUrl}&mode=advanced`, { policy: { ...policy, contentTypes: { text: false, image: true, reasoning: false } }, expectedRevision: 1 })
    assert.equal(unsupported.status, 400); assert.equal(unsupported.body.code, 'HISTORY_ADVANCED_REQUIRED')
    const count = (await events()).length
    for (const [method, suffix, value] of [['GET', '', undefined], ['PUT', '', { policy, expectedRevision: 0 }], ['POST', '/preview', { policy }]]) {
      const missing = await call(method, `${historyRoot}${suffix}?sessionId=missing`, value)
      assert.equal(missing.status, 404, `${method}: ${JSON.stringify(missing.body)}`)
    }
    assert.equal(ctx.sessions.get('missing'), undefined); assert.equal(ctx.agents.get('missing'), undefined)
    assert.equal(face.history.store.get('missing').revision, 0); assert.equal((await events()).length, count)
    await run({ ctx, face, agent, pluginHandle, requests, errors, call, select, nativeId, coreId, historyRoot, historyUrl, assemblyRoot, policy, events, turn })
  } finally { await ctx.fiber.dispose(); rmSync(directory, { recursive: true, force: true }) }
}

for (const withCore of [false, true]) {
  const root = process.env[withCore ? 'DSH_ASSEMBLER_CORE_ROOT' : 'DSH_ASSEMBLER_STOCK_ROOT']
  test(`actual plugin ${withCore ? 'core switch' : 'stock'} integration uses public inspect, native injections and one secured API`, { skip: !root, timeout: 20000 }, () => host(root, withCore, async h => {
    await h.turn('PRE A')
    const firstEvents = json(await h.events())
    const firstInjections = firstEvents.filter(e => e.type === 'user/message' && e.data.source.kind === 'dsh-prompt-assembler')
    assert.equal(firstInjections.length, 3, 'the native plugin entry must commit real pre-step injections')
    assert.deepEqual(h.requests[0].filter(m => m.role === 'user').map(text), ['PRE A', 'PRE B', 'PRE A', 'POST'])
    const firstAssistant = firstEvents.find(e => e.type === 'assistant/message').data.message
    await h.turn('SECOND HUMAN')
    let request = h.requests.at(-1), log = await h.events()
    assert.deepEqual(request.filter(m => m.role === 'user').map(text), ['PRE A', 'PRE A', 'PRE B', 'SECOND HUMAN', 'POST'])
    assert.deepEqual(request.find(m => m.id === firstAssistant.id), firstAssistant)
    assert.deepEqual(log.slice(0, firstEvents.length), firstEvents)
    const tombstones = log.filter(e => e.data.historyPolicy?.action === 'hide')
    assert.equal(tombstones.length, 3)
    assert.ok(tombstones.every(e => e.type === 'developer/message' && e.sourceEventSeqs.includes(e.data.historyPolicy.originalSeq)))
    const preview = await h.call('POST', `${h.historyRoot}/preview?sessionId=combined`, { policy: h.policy })
    assert.equal(preview.status, 200); assert.equal(preview.body.capabilities.mode, 'standard')
    assert.equal(preview.body.operations.length, 3, 'next standard step would clean the just-consumed presets only')
    if (!withCore) {
      const unavailable = await h.call('PUT', `${h.assemblyRoot}/selection`, { sessionId: h.agent.id, id: h.coreId })
      assert.equal(unavailable.status, 409); assert.equal(unavailable.body.code, 'REQUEST_ASSEMBLY_CORE_REQUIRED')
      assert.equal((await h.call('GET', h.historyUrl)).body.capabilities.mode, 'standard')
      await h.pluginHandle.dispose(); await h.turn('WITHOUT PLUGIN')
      assert.ok(h.requests.at(-1).some(m => text(m) === 'WITHOUT PLUGIN'))
      assert.ok(firstInjections.every(e => !h.requests.at(-1).some(m => m.id === e.data.id)))
      assert.deepEqual((await h.events()).slice(0, log.length), log)
      return
    }
    const beforeSwitch = json(log)
    await h.select(h.coreId)
    assert.equal((await h.call('GET', `${h.historyUrl}&mode=standard`)).body.capabilities.mode, 'advanced', 'capabilities follow actual selection, not query assertions')
    const advancedPolicy = { ...h.policy, sources: h.policy.sources.map(r => ({ ...r, include: true })), fragments: [{ id: 'fixture-mvu', sourceKind: 'model', start: '<UpdateVariable>', end: '</UpdateVariable>', mode: 'lines', enabled: true }] }
    assert.equal((await h.call('PUT', h.historyUrl, { policy: advancedPolicy, expectedRevision: 1 })).status, 200)
    const advancedPreview = await h.call('POST', `${h.historyRoot}/preview?sessionId=combined`, { policy: advancedPolicy })
    assert.equal(advancedPreview.status, 200)
    assert.ok(firstInjections.every(e => advancedPreview.body.messages.some(m => m.id === e.data.id)))
    await h.turn('CORE HUMAN')
    request = h.requests.at(-1); log = await h.events()
    assert.ok(firstInjections.every(e => request.some(m => m.id === e.data.id)), 'switching core restores standard placeholders before advanced filtering')
    for (const tombstone of tombstones) {
      assert.ok(log.some(e => e.type === 'user/message' && e.surfaceOp?.startSeq === tombstone.seq && e.sourceEventSeqs.includes(tombstone.data.historyPolicy.originalSeq)))
    }
    assert.deepEqual(log.slice(0, beforeSwitch.length), beforeSwitch)
    const edited = request.find(m => m.id === firstAssistant.id)
    assert.equal(text(edited), 'Before.\nAfter.')
    assert.deepEqual(edited.content.filter(b => b.type === 'reasoning'), firstAssistant.content.filter(b => b.type === 'reasoning'))
    assert.ok(request.some(m => text(m) === 'CORE HUMAN'))
    assert.ok(request.some(m => text(m) === 'PRE B'), 'current core contributions survive')
    const record = json(log.findLast(e => e.type === 'request/assembly' && e.data.metadata?.historyPolicy))
    assert.deepEqual(record.data.messages, request)
    assert.equal(record.data.metadata.historyPolicy.revision, 2)
    await h.select(h.nativeId)
    assert.equal((await h.call('GET', h.historyUrl)).body.capabilities.fragmentFiltering, false)
    const standardPolicy = { ...advancedPolicy, sources: h.policy.sources }
    assert.equal((await h.call('PUT', h.historyUrl, { policy: standardPolicy, expectedRevision: 2 })).status, 200, 'stored advanced fields remain intact and inactive in standard')
    await h.turn('BACK TO STANDARD')
    request = h.requests.at(-1); log = await h.events()
    assert.deepEqual(request.find(m => m.id === firstAssistant.id), firstAssistant)
    assert.ok(request.filter(m => m.role === 'assistant').every(m => text(m) === body && m.content.some(b => b.type === 'reasoning')))
    assert.deepEqual(request.filter(m => m.role === 'user').map(text), ['PRE A', 'SECOND HUMAN', 'CORE HUMAN', 'PRE A', 'PRE B', 'BACK TO STANDARD', 'POST'])
    assert.deepEqual(log.find(e => e.seq === record.seq), record, 'later switching cannot rewrite an earlier actual request')
    assert.deepEqual(log.slice(0, firstEvents.length), firstEvents)
  }))
}

for (const withCore of [false, true]) {
  const root = process.env[withCore ? 'DSH_ASSEMBLER_CORE_ROOT' : 'DSH_ASSEMBLER_STOCK_ROOT']
  test(`strategy history snapshots ${withCore ? 'advanced' : 'standard'}: save, apply, restore and draft preview`, { skip: !root, timeout: 20000 }, () => host(root, withCore, async h => {
    const original = h.face.store.get(withCore ? h.coreId : h.nativeId)
    const policy = { ...h.policy, enabled: false }
    const saved = await h.call('POST', h.assemblyRoot, { ...original, historyPolicy: policy })
    assert.equal(saved.status, 201)
    assert.equal((await h.call('GET', h.historyUrl)).body.policy.enabled, true, 'saving does not apply')
    await h.select(saved.body.preset.id)
    assert.deepEqual((await h.call('GET', h.historyUrl)).body.policy, policy)
    await h.turn('HUMAN ONE')
    const first = (await h.events()).find(e => e.type === 'assistant/message').data.message
    const editedPolicy = { ...h.policy, fragments: [{ id: 'body', sourceKind: 'model', start: '<UpdateVariable>', end: '</UpdateVariable>', mode: 'lines', enabled: true }] }
    const preview = await h.call('POST', `${h.historyRoot}/preview?sessionId=combined`, { backend: 'core', policy: editedPolicy })
    assert.equal(preview.status, 200)
    assert.equal(preview.body.capabilities.mode, 'advanced')
    assert.equal(text(preview.body.messages.find(m => m.id === first.id)), 'Before.\nAfter.')
    assert.equal((await h.call('GET', h.historyUrl)).body.policy.enabled, false)
    const update = await h.call('PUT', `${h.assemblyRoot}/${saved.body.preset.id}`, { ...saved.body.preset, historyPolicy: editedPolicy })
    assert.equal(update.status, 200)
    assert.equal((await h.call('GET', h.historyUrl)).body.policy.enabled, false, 'library updates preserve applied snapshot')
    await h.select(saved.body.preset.id)
    await h.turn('HUMAN TWO')
    const reply = h.requests.at(-1).find(m => m.id === first.id)
    assert.equal(text(reply), withCore ? 'Before.\nAfter.' : body)
    assert.ok(h.requests.at(-1).some(m => text(m) === 'HUMAN ONE'))
    assert.deepEqual((await h.events()).find(e => e.type === 'assistant/message').data.message, first)
    const active = (await h.call('GET', h.historyUrl)).body
    const direct = await h.call('PUT', h.historyUrl, {policy:{...editedPolicy, enabled:false}, expectedRevision:active.revision})
    assert.equal(direct.status, 200)
    assert.equal(h.face.store.get(saved.body.preset.id).historyPolicy.enabled, true, 'direct API only updates applied snapshot')
    assert.equal((await h.call('PUT', h.historyUrl, {policy:editedPolicy, expectedRevision:active.revision})).status, 409)
  }))
}
