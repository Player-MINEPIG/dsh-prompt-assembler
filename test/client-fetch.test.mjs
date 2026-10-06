import test from 'node:test'
import assert from 'node:assert/strict'
import { API_ROOT, createAssemblerFetch } from '../src/client-fetch.js'

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const token = 'a'.repeat(64)

test('ordinary web and desktop reads use native fetch without token exchange', async () => {
  for (const protocol of ['https:', 'dsh-app:']) {
    const calls = []
    const fetcher = createAssemblerFetch({ protocol: () => protocol, fetcher: async (...args) => { calls.push(args); return json({}) } })
    await fetcher(`${API_ROOT}/assembly-presets`, { method: 'GET' })
    if (protocol === 'https:') await fetcher(`${API_ROOT}/assembly-presets`, { method: 'POST', body: '{}' })
    assert.equal(calls.length, protocol === 'https:' ? 2 : 1)
    assert.ok(calls.every(([url]) => !url.endsWith('/request-token')))
  }
})

test('desktop writes share token lookup and preserve existing request headers and body', async () => {
  const calls = []
  const fetcher = createAssemblerFetch({ protocol: () => 'dsh-app:', fetcher: async (url, options) => {
    calls.push([url, options]); return url.endsWith('/request-token') ? json({ token }) : json({ ok: true })
  } })
  await Promise.all([fetcher(`${API_ROOT}/assembly-presets/selection`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"id":"p"}' }), fetcher(`${API_ROOT}/assembly-presets/p`, { method: 'DELETE' })])
  assert.equal(calls.filter(([url]) => url.endsWith('/request-token')).length, 1)
  assert.equal(calls[0][1].headers['X-Assembler-Client'], 'embedded')
  for (const [, options] of calls.slice(1)) assert.equal(options.headers.get('X-Assembler-Request-Token'), token)
  assert.equal(calls[1][1].headers.get('Content-Type'), 'application/json')
  assert.equal(calls[1][1].body, '{"id":"p"}')
})

test('desktop retries only an explicit origin refusal and only once', async () => {
  for (const code of ['ASSEMBLER_API_ORIGIN_FORBIDDEN', 'ASSEMBLER_CONFLICT']) {
    let tokens = 0, writes = 0
    const fetcher = createAssemblerFetch({ protocol: () => 'dsh-app:', fetcher: async url => url.endsWith('/request-token') ? (tokens++, json({ token })) : (writes++, json({ code }, 403)) })
    assert.equal((await fetcher(`${API_ROOT}/assembly-presets/p`, { method: 'PUT' })).status, 403)
    assert.equal(writes, code === 'ASSEMBLER_API_ORIGIN_FORBIDDEN' ? 2 : 1)
    assert.equal(tokens, writes)
  }
})

test('invalid tokens are not cached and no write is sent', async () => {
  let calls = 0
  const fetcher = createAssemblerFetch({ protocol: () => 'dsh-app:', fetcher: async () => { calls++; return json({ token: 'invalid' }) } })
  await assert.rejects(fetcher(`${API_ROOT}/assembly-presets/p`, { method: 'PUT' }), /Invalid assembler/)
  await assert.rejects(fetcher(`${API_ROOT}/assembly-presets/p`, { method: 'PUT' }), /Invalid assembler/)
  assert.equal(calls, 2)
})

test('fetch helper rejects foreign roots and normalized traversal before touching transport', async () => {
  const fetcher = createAssemblerFetch({ protocol: () => 'dsh-app:', fetcher: async () => assert.fail('transport must not run') })
  for (const path of ['/api/v1/session', `${API_ROOT}/../session`, `${API_ROOT}/%2e%2e/session`, `${API_ROOT}/%2f..%2f/session`, `${API_ROOT}/x\\..\\session`, `https://host${API_ROOT}/assembly-presets`, `${API_ROOT}-other/assembly-presets`]) {
    await assert.rejects(fetcher(path, { method: 'PUT' }), /Invalid assembler API path/)
  }
})
