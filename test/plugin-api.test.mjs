import test from 'node:test'
import assert from 'node:assert/strict'
import { secureAssemblerApi } from '../src/api-security.js'
import { createAssemblyApi } from '../src/server.js'
const invoke = async (handler, method, url, headers = {}) => {
  let body = '', status = 200
  const response = { set statusCode(v) { status = v }, get statusCode() { return status }, setHeader() {}, end(value) { body += value ?? '' } }
  await handler({ method, url, headers: { host: 'localhost:3100', ...headers }, socket: { remoteAddress: '127.0.0.1' } }, response)
  return { status, body: body ? JSON.parse(body) : null }
}
test('standalone mutation boundary admits same-origin and desktop tokens, rejects cross-site use', async () => {
  let writes = 0
  const handler = secureAssemblerApi((_req, res) => { writes++; res.end('{"ok":true}') })
  assert.equal((await invoke(handler, 'PUT', '/dsh-prompt-assembler/api/v1/assembly-presets/selection', { 'content-type': 'application/json' })).status, 403)
  const token = await invoke(handler, 'GET', '/dsh-prompt-assembler/api/v1/request-token', { 'x-assembler-client': 'embedded' })
  assert.equal(token.status, 200)
  const headers = { 'content-type': 'application/json', 'x-assembler-request-token': token.body.token }
  assert.equal((await invoke(handler, 'PUT', '/dsh-prompt-assembler/api/v1/assembly-presets/selection', headers)).status, 200)
  assert.equal((await invoke(handler, 'PUT', '/dsh-prompt-assembler/api/v1/assembly-presets/selection', { ...headers, origin: 'https://foreign.invalid' })).status, 403)
  assert.equal((await invoke(handler, 'PUT', '/dsh-prompt-assembler/api/v1/assembly-presets/selection', { 'content-type': 'application/json', origin: 'http://localhost:3100' })).status, 200)
  assert.equal(writes, 2)
})
test('actual request reads durable cold events without preparing an Agent or Session', async () => {
  const recorded = { type: 'request/assembly', data: { messages: [{ id: 'one', role: 'user', content: [{ type: 'text', text: 'ONE' }] }], metadata: { owner: 'pmp-dsh-tavern' } } }
  let reads = 0
  const handler = createAssemblyApi({ store: {}, runtime: {}, agents: () => ({ get: () => undefined }), sessions: () => ({ get: () => undefined }), inspect: async id => { assert.equal(id, 'old'); reads++; return { events: [recorded] } } })
  const response = await invoke(handler, 'GET', '/dsh-prompt-assembler/api/v1/assembly-presets/actual?sessionId=old')
  assert.equal(response.status, 200); assert.deepEqual(response.body.request, recorded.data); assert.equal(reads, 1)
})

test('native selection reads existing durable actual requests regardless of current strategy', async () => {
  const request = { messages: [{ role: 'user', content: [{ type: 'text', text: 'FROZEN' }] }] }
  const handler = createAssemblyApi({ store: {}, runtime: { selected: () => ({ backend: 'native' }) },
    agents: () => ({}), sessions: () => ({}), inspect: async () => ({ events: [{ seq: 10, type: 'request/assembly', data: request }] }) })
  assert.deepEqual((await invoke(handler, 'GET', '/dsh-prompt-assembler/api/v1/assembly-presets/actual?sessionId=old')).body.request, request)
})
test('native observed requests take precedence over older advanced records without falling back on invalid references', async () => {
  let observed = { seq: 20, backend: 'native', request: { messages: [{ role: 'user', content: [] }] }, recordKind: 'native-request-reference' }
  const handler = createAssemblyApi({ store: {}, runtime: {}, agents: () => ({}), sessions: () => ({}),
    inspect: async () => ({ events: [{ seq: 10, type: 'request/assembly', data: { messages: ['OLD'] } }] }), readActual: async () => observed })
  const read = () => invoke(handler, 'GET', '/dsh-prompt-assembler/api/v1/assembly-presets/actual?sessionId=old')
  assert.deepEqual((await read()).body.request, observed.request)
  observed = { ...observed, request: null }
  assert.equal((await read()).body.request, null)
  observed = { ...observed, seq: 5 }
  assert.deepEqual((await read()).body.request.messages, ['OLD'])
})

test('same frozen event can gain verified historical source details without changing its messages', async () => {
  const request = { messages: [{role:'system',content:[{type:'text',text:'ACTUAL'}]}], metadata:null }
  const assembly = { backend:'native', nodes:[{name:'Recorded main',source:{field:'main'}}],diagnostics:[] }
  const handler = createAssemblyApi({store:{},runtime:{},agents:()=>({}),sessions:()=>({}),
    inspect:async()=>({events:[{seq:10,type:'request/assembly',data:request}]}),
    readActual:async()=>({seq:10,backend:'native',request:{...request,metadata:{assembly}}})})
  const read = await invoke(handler,'GET','/dsh-prompt-assembler/api/v1/assembly-presets/actual?sessionId=real')
  assert.deepEqual(read.body.request.messages,request.messages)
  assert.deepEqual(read.body.request.metadata.assembly,assembly)
  assert.equal(request.metadata,null)
})
