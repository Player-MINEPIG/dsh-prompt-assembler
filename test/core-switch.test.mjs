import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { switchRuntime } from '../core-extension/scripts/switch-runtime.mjs'
const put=(p,value)=>{mkdirSync(join(p,'..'),{recursive:true});writeFileSync(p,value)}
function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'assembler-switch-'));t.after(()=>rmSync(root,{recursive:true,force:true}))
 const runtime=join(root,'runtime'),stock=join(root,'stock'),prepared=join(root,'prepared'),home=join(root,'home'),profile=join(home,'profiles/web')
 for(const n of ['session','agent-loop']){
  for(const r of [runtime,stock])put(join(r,`node_modules/@deepseek-ai/dsh-${n}/package.json`),JSON.stringify({version:'0.2.0-rc.2'}))
  for(const file of ['index.js','index.js.map','invariant.js','invariant.js.map']){
   put(join(runtime,`node_modules/@deepseek-ai/dsh-${n}/lib/${file}`),'STANDARD')
   put(join(stock,`node_modules/@deepseek-ai/dsh-${n}/lib/${file}`),'STANDARD')
   put(join(prepared,`${n}/lib/${file}`),'ADVANCED')
  }
 }
 put(join(prepared,'receipt.json'),JSON.stringify({sourceVersion:'0.2.0-rc.2',requestAssemblyVersion:1}))
 put(join(profile,'package.json'),JSON.stringify({dependencies:{}}))
 put(join(profile,'node_modules/dsh-prompt-assembler/package.json'),JSON.stringify({version:'1.1.0',type:'module'}))
 put(join(profile,'node_modules/dsh-prompt-assembler/adapters/tavern.js'),`export const NATIVE_BUILTINS=[{id:'builtin-native-slots',backend:'native',rules:[]}]`)
 const store=join(home,'dsh-prompt-assembler/assembly-presets.json')
 put(store,JSON.stringify({presets:{saved:{backend:'core',rules:[]}},selections:{old:{id:'old',rules:[]},native:{id:'n',backend:'native'},off:null}}))
 const history=join(home,'sessions/history');put(history,'DURABLE HISTORY')
 const calls=[],runPlugin=async args=>{calls.push(args);put(join(profile,'package.json'),JSON.stringify({dependencies:args[0]==='add'?{'dsh-prompt-assembler-core':'file:addon.tgz'}:{}}));return{exitCode:0}}
 return{runtime,stock,prepared,home,store,history,calls,runPlugin,packagePath:join(root,'addon.tgz')}
}
test('install, repeat, uninstall and reinstall preserve history and saved strategies',async t=>{
 const f=fixture(t)
 assert.equal((await switchRuntime({...f,action:'install'})).mode,'advanced')
 assert.equal(readFileSync(join(f.runtime,'node_modules/@deepseek-ai/dsh-agent-loop/lib/index.js'),'utf8'),'ADVANCED')
 await switchRuntime({...f,action:'install',prepared:undefined,stock:undefined})
 const result=await switchRuntime({...f,action:'uninstall'})
 assert.equal(result.migratedSelections,1)
 const state=JSON.parse(readFileSync(f.store));assert.equal(state.selections.old.backend,'native');assert.equal(state.selections.native.id,'n');assert.equal(state.selections.off,null);assert.equal(state.presets.saved.backend,'core')
 assert.equal(readFileSync(f.history,'utf8'),'DURABLE HISTORY')
 assert.equal(readFileSync(join(f.runtime,'node_modules/@deepseek-ai/dsh-agent-loop/lib/index.js'),'utf8'),'STANDARD')
 assert.equal(f.calls.at(-1)[0],'remove')
 await switchRuntime({...f,action:'uninstall'})
 assert.equal((await switchRuntime({...f,action:'install',prepared:undefined,stock:undefined})).mode,'advanced')
})
test('package operation failure never switches core or selections',async t=>{
 const f=fixture(t),before=readFileSync(f.store)
 await assert.rejects(switchRuntime({...f,action:'install',runPlugin:async()=>({exitCode:1})}),/Plugin operation failed/)
 assert.equal(readFileSync(join(f.runtime,'node_modules/@deepseek-ai/dsh-agent-loop/lib/index.js'),'utf8'),'STANDARD');assert.deepEqual(readFileSync(f.store),before)
})
test('changed runtime, wrong versions and tampered backups are refused before package changes',async t=>{
 const f=fixture(t),target=join(f.runtime,'node_modules/@deepseek-ai/dsh-agent-loop/lib/index.js')
 put(target,'UNKNOWN');await assert.rejects(switchRuntime({...f,action:'install'}),/Unrecognized runtime/);assert.equal(f.calls.length,0)
 put(target,'STANDARD');put(join(f.runtime,'node_modules/@deepseek-ai/dsh-session/package.json'),JSON.stringify({version:'0.3.0'}))
 await assert.rejects(switchRuntime({...f,action:'install'}),/Unsupported runtime/);assert.equal(f.calls.length,0)
 put(join(f.runtime,'node_modules/@deepseek-ai/dsh-session/package.json'),JSON.stringify({version:'0.2.0-rc.2'}))
 const standardPackage=join(f.home,'profiles/web/node_modules/dsh-prompt-assembler/package.json')
 put(standardPackage,JSON.stringify({version:'1.0.0',type:'module'}))
 await assert.rejects(switchRuntime({...f,action:'install'}),/Install standard dsh-prompt-assembler@1\.1\.0 first/);assert.equal(f.calls.length,0)
 put(standardPackage,JSON.stringify({version:'1.1.0',type:'module'}));await switchRuntime({...f,action:'install'})
 put(join(f.home,'profiles/web/.assembler-core-switch/standard/agent-loop/lib/index.js'),'BAD')
 await assert.rejects(switchRuntime({...f,action:'uninstall'}),/Backup verification failed/);assert.equal(f.calls.length,1)
})
