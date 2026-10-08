import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parseHTML } from 'linkedom'
import { DEFAULT_HISTORY_POLICY, HistoryPolicyStore, createHistoryPolicyService, createHistoryPolicyApi, HISTORY_API_ROOT } from '../src/history-policy.js'
import { mountHistoryPolicyPanel } from '../src/history-client.js'

test('HTTP and embedded editor select sources, preview, save, reload and reject stale/cross-origin writes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'history-api-'))
  const store = new HistoryPolicyStore(directory)
  const messages = [{ id: 'u', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'HELLO' }] }]
  const service = createHistoryPolicyService({ store, readContext: async () => ({ messages, events: [{ seq: 1, type: 'user/message', data: messages[0] }] }) })
  const server = createServer(createHistoryPolicyApi({ service }))
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const origin = `http://127.0.0.1:${server.address().port}`, endpoint = `${origin}${HISTORY_API_ROOT}?sessionId=test`
  let mounted
  try {
    const { document } = parseHTML('<html><body><main></main></body></html>')
    const request = (url, options) => fetch(`${origin}${url}`, { ...options, headers: { ...options.headers, Origin: origin } })
    mounted = mountHistoryPolicyPanel(document.querySelector('main'), { sessionId: 'test', request })
    await mounted.ready
    document.querySelector('[aria-label="启用历史筛选"]').checked = true
    const buttons = [...document.querySelectorAll('button')]
    await buttons.find(b => b.textContent === '匹配预览').onclick()
    assert.match(document.querySelector('[role=status]').textContent, /预览/)
    await buttons.find(b => b.textContent === '保存规则').onclick()
    assert.equal(store.get('test').revision, 1)
    assert.equal(store.get('test').policy.enabled, true)
    mounted.dispose()
    mounted = mountHistoryPolicyPanel(document.querySelector('main'), { sessionId: 'test', request })
    await mounted.ready
    assert.equal(document.querySelector('[aria-label="启用历史筛选"]').checked, true)
    const body = JSON.stringify({ policy: DEFAULT_HISTORY_POLICY, expectedRevision: 0 })
    assert.equal((await fetch(endpoint, { method: 'PUT', headers: { Origin: origin, 'Content-Type': 'application/json' }, body })).status, 409)
    assert.equal((await fetch(endpoint, { method: 'PUT', headers: { Origin: 'https://foreign.invalid', 'Content-Type': 'application/json' }, body })).status, 403)
    assert.equal((await fetch(endpoint, { method: 'PUT', headers: { Origin: origin, 'Content-Type': 'text/plain' }, body })).status, 415)
    assert.equal((await fetch(`${origin}${HISTORY_API_ROOT}/preview?sessionId=test`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{' })).status, 400)
  } finally { mounted?.dispose(); await new Promise(resolve => server.close(resolve)); rmSync(directory, { recursive: true, force: true }) }
})
