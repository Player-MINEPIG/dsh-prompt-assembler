import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import plugin, { BUILTINS, AssemblyPresetStore, RequestAssembler, createDshRegistry, textOf } from '../src/index.js'
import { CoreRequestBackend } from '../src/core-backend.js'
import { NATIVE_BUILTINS, BUILTINS as advanced, registerTavernSources } from '../adapters/tavern.js'
import { validateNativePreset } from '../src/native-policy.js'
const input = (id, text = id) => ({ id, role: 'user', content: [{type:'text',text}], source:{kind:'user'} })

test('native layouts reject legacy core strategies, history switches, system tails and unsupported roles without rewriting', () => {
  for (const p of NATIVE_BUILTINS) assert.equal(validateNativePreset(p).backend, 'native')
  for (const p of advanced) assert.throws(() => validateNativePreset(p), {code:'ASSEMBLY_NATIVE_UNSUPPORTED'})
  const p = structuredClone(NATIVE_BUILTINS[0]), before = JSON.stringify(p)
  for (const mutate of [p => p.rules.find(r=>r.kind==='history').enabled=false, p=>p.rules.find(r=>r.kind==='input').enabled=false,
    p=>p.rules[1].role='assistant',p=>p.rules[1].depth=1,p=>p.rules[1].lifetime='snapshot',p=>p.rules.push({id:'tail',kind:'dsh.text',enabled:true,role:'system'})]) {
    const copy=structuredClone(p); mutate(copy); assert.throws(()=>validateNativePreset(copy),{code:'ASSEMBLY_NATIVE_UNSUPPORTED'})
  }
  assert.equal(JSON.stringify(p),before)
})

test('protocol availability alone never enables advanced execution; optional backend attaches once and detaches cleanly', async () => {
  const ctx={get:key=>key==='agentLoop'?{requestAssemblyVersion:1}:key==='systemPrompt'?{assemble(){}}:undefined}
  const runtime=new RequestAssembler({ctx,store:{selection:()=>advanced[0]},resources:{}})
  assert.equal(runtime.available(),true); assert.equal(runtime.requestAssemblyAvailable(),false)
  assert.throws(()=>runtime.requireAvailable(advanced[0]),{code:'REQUEST_ASSEMBLY_CORE_REQUIRED'})
  const stop=runtime.registerRequestBackend(new CoreRequestBackend(runtime));assert.equal(runtime.requestAssemblyAvailable(),true)
  assert.throws(()=>runtime.registerRequestBackend(new CoreRequestBackend(runtime)),/already installed/)
  stop();assert.equal(runtime.requestAssemblyAvailable(),false)
})

const stock=process.env.DSH_ASSEMBLER_STOCK_ROOT
for(const inHistory of [false,true])test(`standard install on stock rc.2: ${inHistory?'in-history':'head'} route, durable user delivery, unload and detached restore`,{skip:!stock,timeout:15000},async()=>{
  const { default: corePlugin } = await import('../core-extension/src/plugin.js')
  const require=createRequire(join(resolve(stock),'package.json')),load=name=>import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)))
  const {Context}=await load('cordis'),{SystemPrompt}=await load('dsh-system-prompt'),llm=await load('dsh-llm'),sessions=await load('dsh-session')
  const ctx=new Context(),root=mkdtempSync(join(tmpdir(),'assembler-native-')),requests=[],errors=[]
  try {
    await ctx.plugin(SystemPrompt,{includeHarnessIdentity:false,personaPrefix:'OFFICIAL'})
    for(const name of ['session','agent','session-projection','llm','tools','agent-loop'])await ctx.plugin((await load(`dsh-${name}`)).default,name==='agent-loop'?{agents:[]}:{})
    ctx.provide('sessionController',{})
    ctx.on('agent/error',e=>errors.push(e.error))
    class Provider extends llm.LlmAdapter {
      async resolveModel(provider,id){return {provider,id,name:id,...inHistory?{systemPromptUpdate:'in-history'}:{}}}
      async *stream(request){assert.ok(Object.isFrozen(request));assert.deepEqual(request.messages,ctx.sessions.get(request.sessionId).deriveMessages());requests.push(structuredClone(request.messages));yield {type:'block-start',index:0,blockType:'text'};yield {type:'text-delta',index:0,text:'ANSWER'};yield {type:'block-end',index:0,block:{type:'text',text:'ANSWER'}};yield {type:'finish',reason:{kind:'stop'}}}
    }
    ctx.llm.registerAdapter(['offline'],new Provider())
    const installed=ctx.plugin(plugin,{storageDir:root});await installed
    const face=ctx.get('dshPromptAssembler')
    assert.equal(ctx.agentLoop.requestAssemblyVersion,undefined)
    assert.equal(face.runtime.capabilities().core,false)
    // Even a prepared core addon cannot mount on stock DSH.
    assert.throws(()=>corePlugin.apply({get:()=>face}),{code:'REQUEST_ASSEMBLY_CORE_REQUIRED'})
    let location='DOCK', failOnce=true
    const stopSource=face.registry.register({id:'example.notes',pluginId:'example',name:'Notes',resolve:context=>{
      if(failOnce){failOnce=false;throw new Error('Intentional source failure')}
      assert.equal(context.inputIds.length,1,'failed assembly must not retain previously claimed inputs')
      return {blocks:[{id:'location',type:'text',text:location}]}
    }})
    const p=face.store.save({...BUILTINS[0],name:'Native controlled',rules:[
      {id:'first',kind:'dsh.text',inputMode:'text',text:'FIRST',role:'system'},...BUILTINS[0].rules,
      {id:'context',kind:'example.notes',role:'user',delivery:'context'},
      {id:'phi',kind:'dsh.text',inputMode:'text',text:'REMINDER',role:'user',delivery:'pre-step'}]})
    face.runtime.requireAvailable(p);face.store.apply('native',p.id)
    const agent=(await ctx.agents.create({sessionId:'native',agentOptions:{provider:'offline',model:'offline'}})).agent
    const turn=async text=>{agent.followup(llm.createUserMessage({content:[{type:'text',text}],source:{kind:'user'}}));await agent.whenIdle();assert.deepEqual(errors,[])}
    agent.followup(llm.createUserMessage({content:[{type:'text',text:'FAILED'}],source:{kind:'user'}}))
    await agent.whenIdle();assert.equal(requests.length,0);assert.equal(errors.length,1);errors.length=0
    await turn('ONE')
    assert.match(textOf(requests[0].find(m=>m.role==='system')),/^FIRST\n\nOFFICIAL$/)
    assert.deepEqual(requests[0].slice(-3).map(textOf),['ONE','Current runtime context. This snapshot supersedes earlier runtime-context snapshots.\n\nDOCK','REMINDER'])
    await turn('TWO')
    assert.equal(agent.session.snapshotEvents().filter(e=>e.type==='user/message'&&e.data.source?.kind==='runtime-context').length,1)
    assert.equal(requests[1].filter(m=>textOf(m)==='REMINDER').length,2)
    assert.ok(!agent.session.snapshotEvents().some(e=>e.type==='request/assembly'))
    const noNative={...p,rules:p.rules.map(r=>r.kind==='native-system'?{...r,enabled:false}:r)}
    face.store.applySnapshot('native',noNative); location='PIER';await turn('THREE')
    assert.equal(textOf(requests[2].filter(m=>m.role==='system').at(-1)),'FIRST')
    assert.ok(!requests[2].some(m=>m.role==='system'&&textOf(m).includes('OFFICIAL')), 'disabling native system clears earlier effective system updates')
    assert.equal(requests[2].findIndex(m=>m.role==='system'),0)
    assert.ok(agent.session.snapshotEvents().some(e=>e.type==='system/message'&&textOf(e.data.message).includes('OFFICIAL')), 'original system events remain durable')
    stopSource();await turn('FOUR')
    assert.ok(requests[3].some(m=>textOf(m).includes('DOCK')),'prior snapshots remain historical')
    assert.ok(requests[3].some(m=>textOf(m).includes('Earlier runtime-context snapshots no longer apply.')))
    const stored=readFileSync(face.store.path)
    await installed.dispose();await turn('FIVE')
    assert.equal(textOf(requests[4].filter(m=>m.role==='system').at(-1)),'OFFICIAL')
    assert.deepEqual(readFileSync(join(root,'assembly-presets.json')),stored)
    assert.equal(requests[4].filter(m=>textOf(m)==='REMINDER').length,4)
    const restored=sessions.Session.fromRestore(agent.id,structuredClone(agent.session.snapshotEvents()),agent.session.header,sessions.SessionLogOffset(0),'detached')
    assert.deepEqual(restored.deriveMessages(),agent.session.deriveMessages())
  }finally{await ctx.fiber.dispose();rmSync(root,{recursive:true,force:true})}
})


test('native API rejects unsupported application without changing the applied selection or legacy strategy', async () => {
  const { Readable } = await import('node:stream'), { createAssemblyApi } = await import('../src/server.js')
  const directory = mkdtempSync(join(tmpdir(), 'native-api-'))
  try {
    const store = new AssemblyPresetStore(directory), runtime = new RequestAssembler({ ctx: { get: key => key === 'systemPrompt' ? { assemble() {} } : { requestAssemblyVersion: 1 } }, store, resources: {} })
    store.apply('s', BUILTINS[0].id)
    const legacy = store.save(advanced[0]), invalid = store.save({ ...NATIVE_BUILTINS[0], rules: NATIVE_BUILTINS[0].rules.map(r => r.kind === 'history' ? { ...r, enabled: false } : r) })
    const before = readFileSync(store.path)
    const handler = createAssemblyApi({ store, runtime, agents: () => new Map(), sessions: () => new Map() })
    for (const [id, code] of [[legacy.id, 'REQUEST_ASSEMBLY_CORE_REQUIRED'], [invalid.id, 'ASSEMBLY_NATIVE_UNSUPPORTED']]) {
      let data; const req = Readable.from([Buffer.from(JSON.stringify({ sessionId: 's', id }))]); Object.assign(req, { method: 'PUT', url: '/dsh-prompt-assembler/api/v1/assembly-presets/selection' })
      const res = { setHeader() {}, end(body) { data = JSON.parse(body) } }; await handler(req, res)
      assert.equal(res.statusCode, 409); assert.equal(data.code, code); assert.deepEqual(readFileSync(store.path), before)
    }
    assert.equal(store.get(legacy.id).backend, undefined)
    const mixed = structuredClone(NATIVE_BUILTINS[2]); mixed.rules.push({ id: 'context-last', kind: 'dsh.text', inputMode: 'text', text: 'X', role: 'user', delivery: 'context' })
    assert.throws(() => validateNativePreset(mixed), { code: 'ASSEMBLY_NATIVE_UNSUPPORTED' })
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

 test('trusted sessionless preview variables render native sections without an Agent or model request', async () => {
  let assembled
  const runtime = new RequestAssembler({ ctx: { get: key => key === 'systemPrompt' ? {async assemble(context) {
    assembled = context
    return {sections:[{name:'official',text:'{{provider}}/{{model}} at {{cwd}}'}],variables:{provider:undefined,model:undefined,cwd:undefined}}
  }} : undefined }, store:{}, resources:{compile:()=>({assemblyInput:{}})} })
  const result = await runtime.preview({preset:BUILTINS[0],nativeVariables:{provider:'offline',model:'draft',cwd:'/tmp'}})
  assert.match(result.messages.map(textOf).join('\n'), /offline\/draft at \/tmp/)
  assert.equal(assembled.agent, undefined); assert.equal(assembled.scope, undefined)
  assert.equal(result.backend,'native'); assert.equal(result.pendingInputsIncluded,false)
 })

for (const inHistory of [false, true]) test(`native preset ordering uses public stock Host seams (${inHistory ? 'in-history' : 'head'})`, { skip: !stock, timeout: 15000 }, async () => {
  const require = createRequire(join(resolve(stock), 'package.json')), load = name => import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)))
  const { Context } = await load('cordis'), { SystemPrompt } = await load('dsh-system-prompt'), llm = await load('dsh-llm')
  const ctx = new Context(), root = mkdtempSync(join(tmpdir(), 'native-order-host-')), requests = [], errors = []
  try {
    await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false, personaPrefix: 'OFFICIAL' })
    for (const name of ['session', 'agent', 'session-projection', 'llm', 'tools', 'agent-loop']) await ctx.plugin((await load(`dsh-${name}`)).default, name === 'agent-loop' ? { agents: [] } : {})
    ctx.provide('sessionController', {}); ctx.on('agent/error', e => errors.push(e.error))
    class Provider extends llm.LlmAdapter {
      async resolveModel(provider, id) { return { provider, id, name: id, ...inHistory ? { systemPromptUpdate: 'in-history' } : {} } }
      async *stream(request) {
        assert.ok(Object.isFrozen(request)); assert.deepEqual(request.messages, ctx.sessions.get(request.sessionId).deriveMessages())
        requests.push(structuredClone(request.messages))
        yield { type: 'block-start', index: 0, blockType: 'text' }; yield { type: 'text-delta', index: 0, text: 'ANSWER' }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: 'ANSWER' } }; yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
    ctx.llm.registerAdapter(['offline'], new Provider())
    await ctx.plugin(plugin, { storageDir: root })
    const face = ctx.get('dshPromptAssembler'); registerTavernSources(face.registry)
    let prompts = [{ identifier: 'mixed', name: 'Mixed', enabled: true, role: 'user', content: 'OPEN{{history}}MIDDLE{{input}}CLOSE' }]
    face.runtime.resources = { compile: () => ({ assemblyInput: { preset: { id: 'fixture', prompts } } }) }
    const selected = face.store.save({ ...NATIVE_BUILTINS.find(p => p.placement === 'native-slots'), name: 'Slots' })
    face.store.apply('ordered', selected.id)
    const agent = (await ctx.agents.create({ sessionId: 'ordered', agentOptions: { provider: 'offline', model: 'offline' } })).agent
    const turn = async text => { agent.followup(llm.createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })); await agent.whenIdle(); assert.deepEqual(errors, []) }
    await turn('ONE')
    assert.match(textOf(requests[0][0]), /OFFICIAL\n\nOPEN$/)
    assert.deepEqual(requests[0].slice(1).map(textOf), ['MIDDLE', 'ONE', 'CLOSE'])
    assert.deepEqual(requests[0].slice(1).map(m => m.role), ['user', 'user', 'user'])
    assert.deepEqual(requests[0].slice(1).map(m => m.source.kind), ['dsh-prompt-assembler', 'user', 'dsh-prompt-assembler'])
    assert.equal(requests[0].at(-1).source.form, 'instructions')
    const firstIds = requests[0].slice(1).map(m => m.id)
    prompts = [{ ...prompts[0], content: 'NEW OPEN{{history}}MIDDLE{{input}}CLOSE' }]
    await turn('TWO')
    assert.match(textOf(requests[1][0]), /NEW OPEN$/)
    assert.equal(requests[1].filter(m => m.role === 'system').length, 1)
    assert.deepEqual(requests[1].slice(-3).map(textOf), ['MIDDLE', 'TWO', 'CLOSE'])
    assert.deepEqual(requests[1].filter(m => firstIds.includes(m.id)).map(m => m.id), firstIds)
    face.store.applySnapshot('ordered', { ...selected, placement: 'native-roles' })
    prompts = [{ identifier: 's', enabled: true, role: 'system', content: 'ROLE SYSTEM' }, { identifier: 'u', enabled: true, role: 'user', content: 'ROLE USER' }]
    await turn('THREE')
    assert.match(textOf(requests[2][0]), /ROLE SYSTEM$/)
    assert.equal(requests[2].at(-1).role, 'user'); assert.match(textOf(requests[2].at(-1)), /ROLE USER$/)
    assert.ok(!agent.session.snapshotEvents().some(e => e.type === 'request/assembly'))
  } finally { await ctx.fiber.dispose(); rmSync(root, { recursive: true, force: true }) }
})
