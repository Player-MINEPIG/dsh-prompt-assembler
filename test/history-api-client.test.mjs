import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parseHTML } from 'linkedom'
import { DEFAULT_HISTORY_POLICY, HistoryPolicyStore, createHistoryPolicyService, createHistoryPolicyApi, HISTORY_API_ROOT } from '../src/history-policy.js'
import { mountHistoryPolicyPanel } from '../src/history-client.js'

for (const mode of ['advanced', 'standard']) test(`${mode}: HTTP and embedded editor select sources, preview, save, reload and reject stale/cross-origin writes`, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'history-api-'))
  const store = new HistoryPolicyStore(directory)
  const messages = [{ id: 'u', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'HELLO' }] }]
  const service = createHistoryPolicyService({ store, mode, readContext: async () => ({ nodes: [1], messages, events: [{ seq: 1, type: 'user/message', data: messages[0], surfaceOp: 'append' }, { seq: 2, type: 'step/end' }] }) })
  const server = createServer(createHistoryPolicyApi({ service }))
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`, endpoint = `${origin}${HISTORY_API_ROOT}?sessionId=test`
  let mounted
  try {
    const { document } = parseHTML('<html><body><main></main></body></html>')
    const request = (url, options) => fetch(`${origin}${url}`, { ...options, headers: { ...options.headers, Origin: origin } })
    mounted = mountHistoryPolicyPanel(document.querySelector('main'), { sessionId: 'test', request })
    await mounted.ready
    assert.equal(Boolean(document.querySelector('[aria-label="保留reasoning"]').disabled), mode === 'standard')
    assert.equal(Boolean(document.querySelector('[aria-label="片段规则 JSON"]').disabled), mode === 'standard')
    assert.equal(Boolean(document.querySelector('[aria-label="保留来源 user"]').disabled), mode === 'standard')
    assert.equal(Boolean(document.querySelector('[aria-label="保留来源 dsh-prompt-assembler"]').disabled), false)
    assert.equal(document.querySelector('[aria-label="保留来源 system-prompt"]').checked, false)
    assert.equal(Boolean(document.querySelector('[aria-label="保留来源 system-prompt"]').disabled), false)
    document.querySelector('[aria-label="启用历史筛选"]').checked = true
    const buttons = [...document.querySelectorAll('button')]
    await buttons.find(b => b.textContent === '匹配预览').onclick()
    assert.match(document.querySelector('[role=status]').textContent, /预览/)
    await buttons.find(b => b.textContent === '保存历史规则').onclick()
    assert.equal(store.get('test').revision, 1)
    assert.equal(document.querySelector('[aria-label="历史匹配预览"]').children.length, 0)
    assert.equal(store.get('test').policy.enabled, true)
    mounted.dispose()
    mounted = mountHistoryPolicyPanel(document.querySelector('main'), { sessionId: 'test', request })
    await mounted.ready
    assert.equal(document.querySelector('[aria-label="启用历史筛选"]').checked, true)
    if (mode === 'standard') {
      const policy = { ...store.get('test').policy, contentTypes: { text: false, image: true, reasoning: false } }
      const response = await fetch(endpoint, { method: 'PUT', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ policy, expectedRevision: 1 }) })
      assert.equal(response.status, 400)
      assert.equal((await response.json()).code, 'HISTORY_ADVANCED_REQUIRED')
      assert.equal(store.get('test').revision, 1)
    }
    const body = JSON.stringify({ policy: DEFAULT_HISTORY_POLICY, expectedRevision: 0 })
    assert.equal((await fetch(endpoint, { method: 'PUT', headers: { Origin: origin, 'Content-Type': 'application/json' }, body })).status, 409)
    assert.equal((await fetch(endpoint, { method: 'PUT', headers: { Origin: 'https://foreign.invalid', 'Content-Type': 'application/json' }, body })).status, 403)
    assert.equal((await fetch(endpoint, { method: 'PUT', headers: { Origin: origin, 'Content-Type': 'text/plain' }, body })).status, 415)
    assert.equal((await fetch(`${origin}${HISTORY_API_ROOT}/preview?sessionId=test`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{' })).status, 400)
  } finally { mounted?.dispose(); await new Promise(resolve => server.close(resolve)); rmSync(directory, { recursive: true, force: true }) }
})

test('history preview colors removal, retained fragments and restored messages without rewriting their text', async () => {
  const {document} = parseHTML('<main></main>')
  const message = (id,text) => ({id,role:'assistant',content:[{type:'text',text}]})
  const rows = [
    {action:'exclude',original:message('a','remove all'),blocks:[],reasons:[],role:'user',sourceKind:'plugin'},
    {action:'edit',original:message('b','before [remove] after'),blocks:[{index:0,ranges:[{start:7,end:15}]}],reasons:[],role:'assistant',sourceKind:'model'},
    {action:'restore',original:message('c','restore saved text'),blocks:[],reasons:[],role:'user',sourceKind:'plugin'},
  ]
  const editor = mountHistoryPolicyPanel(document.querySelector('main'), {sessionId:'fixture',backend:'core',value:DEFAULT_HISTORY_POLICY,onChange:()=>{},request:async()=>new Response(JSON.stringify({ok:true,preview:rows,audit:{decisions:rows,warnings:[]}}))})
  try {
    await editor.ready
    await [...document.querySelectorAll('button')].find(b=>b.textContent==='匹配预览').onclick()
    assert.equal(document.querySelectorAll('.history-results details[open]').length, 0, 'all preview messages start collapsed')
    const chunks = [...document.querySelectorAll('.history-diff span')].map(n=>[n.className,n.textContent])
    assert.deepEqual(chunks,[['history-diff-remove','remove all'],['history-diff-keep','before '],['history-diff-remove','[remove]'],['history-diff-keep',' after'],['history-diff-add','restore saved text']])
  } finally {editor.dispose()}
})
