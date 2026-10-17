import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import plugin from '../src/plugin.js'
import { requireAssemblerOwner } from '../src/api-security.js'
import { API_ROOT, API_V1 } from '../src/identity.js'
import { BUILTINS } from '../src/model.js'
import { HISTORY_API_ROOT } from '../src/history/server.js'

const root = process.env.DSH_ASSEMBLER_STOCK_ROOT
const authority = '198.51.100.10:3080'

async function invoke(handler, method, url, headers = {}, body = {}, address = '198.51.100.20') {
  const req = Readable.from([Buffer.from(JSON.stringify(body))])
  Object.assign(req, { method, url, headers: { host: authority, ...headers }, socket: { remoteAddress: address } })
  let status = 200, output = ''
  await handler(req, { set statusCode(value) { status = value }, setHeader() {}, end(value) { output += value ?? '' } })
  return { status, body: output ? JSON.parse(output) : null }
}

test('owner boundary fails closed without authentication and for non-owner principals', async () => {
  let calls = 0
  for (const [getConnection, expected] of [
    [undefined, 503],
    [() => ({}), 503],
    [() => ({ admit: () => undefined }), 403],
    [() => ({ admit: () => ({ peer: { principal: { kind: 'agent' } } }) }), 403],
  ]) {
    const guarded = requireAssemblerOwner((_req, res) => { calls++; res.end('{}') }, getConnection)
    assert.equal((await invoke(guarded, 'GET', API_V1)).status, expected)
  }
  assert.equal(calls, 0)
})

test('installed routes require real DSH owner authentication before assembly, history and request tokens', { skip: !root }, async t => {
  const require = createRequire(join(resolve(root), 'package.json'))
  const load = name => import(pathToFileURL(require.resolve('@deepseek-ai/' + name)).href)
  const { Context } = await load('cordis'), connectionPlugin = await load('dsh-client-connection')
  const ctx = new Context(), directory = await mkdtemp(join(tmpdir(), 'assembler-remote-auth-'))
  t.after(async () => { await ctx.fiber.dispose(); await rm(directory, { recursive: true, force: true }) })
  const records = new Map(), routes = new Set()
  ctx.provide('credentials', { async modifyRecord(key, change) {
    const update = await change(records.get(key))
    if (update) records.set(key, update)
    return records.get(key)
  } })
  ctx.provide('webServer', { host: '198.51.100.10', protocol: 'http:', register(route) { routes.add(route); return () => routes.delete(route) } })
  ctx.provide('systemPrompt', { assemble() {} })
  ctx.provide('sessionController', { async inspect() { return { events: [] } } })
  await ctx.plugin(connectionPlugin, {})
  const connection = ctx.get('connection')
  const login = new URL(connection.authenticatedUrl('http://' + authority))
  let loginStatus, cookie
  connection.authorizeIndex({ method: 'GET', url: login.pathname + login.search, headers: { host: authority } }, {
    writeHead(status, headers) { loginStatus = status; cookie = headers['set-cookie'].split(';')[0] }, end() {},
  })
  assert.equal(loginStatus, 303)
  const config = { storageDir: directory, security: { allowRemoteClients: true, allowedHosts: ['198.51.100.10'] } }
  const mounted = ctx.plugin(plugin, config); await mounted
  await new Promise(resolve => setImmediate(resolve))
  const route = [...routes].find(route => route.path === API_ROOT)
  assert.ok(route)
  const paths = [API_V1, `${HISTORY_API_ROOT}?sessionId=fixture`, `${API_ROOT}/request-token`]
  for (const path of paths) {
    const headers = { 'x-assembler-client': 'embedded' }
    assert.equal((await invoke(route.handler, 'GET', path, { ...headers, cookie })).status, 200, path)
    for (const [changes, expected, address] of [
      [{}, 401],
      [{ 'x-forwarded-for': '127.0.0.1', 'x-forwarded-host': authority }, 401],
      [{ cookie: 'forged-fixture-cookie', origin: 'http://' + authority }, 401],
      [{ cookie, host: 'attacker.invalid', 'x-forwarded-host': authority }, 403],
      [{ cookie, origin: 'https://attacker.invalid' }, 403],
      [{ cookie, 'sec-fetch-site': 'cross-site' }, 403],
      [{}, 401, '127.0.0.1'],
    ]) assert.equal((await invoke(route.handler, 'GET', path, { ...headers, ...changes }, {}, address)).status, expected, path)
  }
  const preset = { ...BUILTINS[0], id: 'remote-owner', name: 'Remote owner' }
  const ownerHeaders = { cookie, origin: 'http://' + authority, 'content-type': 'application/json' }
  assert.equal((await invoke(route.handler, 'POST', API_V1, ownerHeaders, preset)).status, 201)
  for (const [headers, status] of [
    [{ ...ownerHeaders, cookie: undefined }, 401],
    [{ ...ownerHeaders, origin: 'https://attacker.invalid' }, 403],
    [{ ...ownerHeaders, 'content-type': 'text/plain' }, 415],
    [{ cookie, 'content-type': 'application/json' }, 403],
  ]) assert.equal((await invoke(route.handler, 'POST', API_V1, headers, preset)).status, status)
  const token = await invoke(route.handler, 'GET', `${API_ROOT}/request-token`, { cookie, 'x-assembler-client': 'embedded' })
  assert.equal((await invoke(route.handler, 'POST', API_V1, { cookie, 'content-type': 'application/json', 'x-assembler-request-token': token.body.token }, { ...preset, name: 'Desktop owner' })).status, 201)
  await mounted.dispose()
  assert.ok(![...routes].some(route => route.path === API_ROOT))
  const remounted = ctx.plugin(plugin, config); await remounted
  await new Promise(resolve => setImmediate(resolve))
  const fresh = [...routes].find(route => route.path === API_ROOT)
  assert.equal((await invoke(fresh.handler, 'GET', API_V1)).status, 401)
  assert.equal((await invoke(fresh.handler, 'GET', API_V1, { cookie })).status, 200)
  assert.equal((await invoke(fresh.handler, 'POST', API_V1, { cookie, 'content-type': 'application/json', 'x-assembler-request-token': token.body.token }, preset)).status, 403)
})
