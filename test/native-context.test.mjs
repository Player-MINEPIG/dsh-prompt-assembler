import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import plugin, { BUILTINS, textOf } from '../src/index.js'
import { CONTEXT_CONTROLS, contextControlRows, filterNativeContexts } from '../src/native-context.js'
import { normalizePreset } from '../src/model.js'
const rules = disabled => CONTEXT_CONTROLS.map(c => ({id:c.kind.replaceAll('.','-'),kind:c.kind,enabled:!disabled.includes(c.kind)}))
test('context controls use exact source names, default to retained, and never filter by role or prefix', () => {
  const assembly={contexts:['sandbox:policy','approval:policy','subagent:delegation','worldbook','memory-manager','sandbox:custom'].map(name=>({name,text:name})),sections:[{name:'system',text:'UNCHANGED'}],tools:[{name:'probe'}]}
  const before=structuredClone(assembly)
  assert.equal(filterNativeContexts(assembly,{rules:[]}),assembly)
  assert.deepEqual(filterNativeContexts(assembly,{rules:rules(['dsh.sandbox-policy'])}).contexts.map(c=>c.name),['approval:policy','subagent:delegation','worldbook','memory-manager','sandbox:custom'])
  assert.deepEqual(filterNativeContexts(assembly,{rules:rules(['dsh.runtime-context'])}).contexts.map(c=>c.name),['worldbook','memory-manager','sandbox:custom'])
  assert.deepEqual(assembly,before)
  const p=normalizePreset({...BUILTINS[0],rules:[...BUILTINS[0].rules,...rules(['dsh.approval-policy'])]})
  assert.equal(p.rules.find(r=>r.kind==='dsh.approval-policy').enabled,false)
  assert.equal(contextControlRows(p.rules).length,p.rules.length)
  const collision=contextControlRows([{id:'dsh-runtime-context',kind:'dsh.text'}])
  assert.equal(new Set(collision.map(r=>r.id)).size,collision.length)
})
for (const route of ['native','core']) {
  const root=process.env[route==='native'?'DSH_ASSEMBLER_STOCK_ROOT':'DSH_ASSEMBLER_CORE_ROOT']
  test(`real Host ${route}: source toggles preserve foreign context, history and enforcement`,{skip:!root,timeout:15000},async()=>{
    const require=createRequire(join(resolve(root),'package.json')),load=name=>import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)))
    const {Context}=await load('cordis'),{SystemPrompt}=await load('dsh-system-prompt'),llm=await load('dsh-llm')
    const ctx=new Context(),dir=mkdtempSync(join(tmpdir(),'context-controls-')),requests=[],errors=[]
    try {
      await ctx.plugin(SystemPrompt,{includeHarnessIdentity:false,personaPrefix:'OFFICIAL'})
      for(const name of ['session','agent','session-projection','llm','tools','agent-loop']) await ctx.plugin((await load(`dsh-${name}`)).default,name==='agent-loop'?{agents:[]}:{})
      await ctx.plugin((await load('dsh-sandbox-policy')).default,{mode:'read-only',workspaceRoot:dir})
      await ctx.plugin((await load('dsh-user-approval')).default,{policy:'ask'})
      ctx.provide('sessionController', { inspect: id => ({ events: ctx.sessions.get(id).snapshotEvents() }) })
      ctx.systemPrompt.context({name:'third-party:worldbook',order:200,text:'FOREIGN CONTEXT'})
      ctx.on('agent/error',e=>errors.push(e.error))
      class Provider extends llm.LlmAdapter {
        async resolveModel(provider,id){return {provider,id,name:id}}
        async *stream(request){requests.push(structuredClone(request.messages));yield {type:'block-start',index:0,blockType:'text'};yield {type:'block-end',index:0,block:{type:'text',text:'ANSWER'}};yield {type:'finish',reason:{kind:'stop'}}}
      }
      ctx.llm.registerAdapter(['offline'],new Provider())
      const handle=ctx.plugin(plugin,{storageDir:dir});await handle
      const face=ctx.get('dshPromptAssembler')
      if(route==='core') {const {default:core}=await import('../core-extension/src/plugin.js');await ctx.plugin(core,{})}
      const agent=(await ctx.agents.create({sessionId:'controls',agentOptions:{provider:'offline',model:'offline'}})).agent
      const preset={...BUILTINS[0],backend:route,rules:[...BUILTINS[0].rules,{id:'memory',kind:'dsh.text',role:'user',delivery:'context',text:'MEMORY'}]}
      const turn=async disabled=>{
        face.store.applySnapshot(agent.id,{...preset,rules:[...preset.rules,...rules(disabled)]})
        agent.followup(llm.createUserMessage({content:[{type:'text',text:'INPUT'}],source:{kind:'user'}}));await agent.whenIdle();assert.deepEqual(errors,[])
        assert.equal(ctx.sandboxPolicy.resolve({session:agent.session}).mode,'read-only')
        assert.equal(ctx.approval.effectivePolicy(agent.session),'ask')
        return requests.at(-1).filter(m=>m.source?.kind==='runtime-context'&&m.source?.form==='snapshot').at(-1)
      }
      let latest=await turn([]);assert.match(textOf(latest),/Current DSH file policy/);assert.match(textOf(latest),/Approval policy/)
      latest=await turn(['dsh.sandbox-policy']);assert.doesNotMatch(textOf(latest),/Current DSH file policy/);assert.match(textOf(latest),/Approval policy/)
      latest=await turn(['dsh.runtime-context']);assert.equal(textOf(latest),'Current runtime context. This snapshot supersedes earlier runtime-context snapshots.\n\nFOREIGN CONTEXT'+(route==='native'?'\n\nMEMORY':''))
      assert.ok(requests.at(-1).some(m=>textOf(m)==='ANSWER'),'old conversation is retained')
      const preview=await face.runtime.preview({preset:face.store.selection(agent.id),agent,sessionId:agent.id})
      assert.ok(preview.runtimeContextControls.every(c=>!c.enabled))
      latest=await turn([]);assert.match(textOf(latest),/Current DSH file policy/);assert.match(textOf(latest),/Approval policy/)
      await handle.dispose()
      const original=await ctx.systemPrompt.assemble({agent,scope:agent})
      assert.ok(original.contexts.some(c=>c.name==='sandbox:policy'))
    } finally {await ctx.fiber.dispose();rmSync(dir,{recursive:true,force:true})}
  })
}
