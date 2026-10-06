import test from 'node:test'
import assert from 'node:assert/strict'
import { RequestSourceRegistry, assembleRequestAsync, FORMAT } from '../src/index.js'
test('parser-only providers never advertise a module but assemble authored text', async () => {
 const registry = new RequestSourceRegistry()
 const stop=registry.register({id:'scattered',pluginId:'notes',name:'Scattered notes',parseText:(_ctx,rule)=>({blocks:[{id:'text',type:'text',text:rule.text.replace('[[note]]','FOUND')} ]})})
 assert.equal(registry.list()[0].supportsModule,false);assert.equal(registry.list()[0].moduleAvailable,false);assert.equal(registry.list()[0].acceptsText,true)
 const preset={format:FORMAT,version:1,name:'Text',rules:[{id:'one',kind:'scattered',inputMode:'text',role:'user',text:'[[note]]'},{id:'two',kind:'scattered',inputMode:'text',role:'user',text:'other'}]}
 const result=await assembleRequestAsync({registry,preset});assert.deepEqual(result.messages.map(m=>m.content[0].text),['FOUND','other'])
 await assert.rejects(assembleRequestAsync({registry,preset:{...preset,rules:[{id:'module',kind:'scattered',role:'user'}]}}),/only supplies a text parser/)
 stop();assert.equal(registry.list().length,0)
})
test('module metadata availability is independent of parser discovery',()=>{
 const registry=new RequestSourceRegistry();registry.register({id:'bound',pluginId:'notes',name:'Bound module',moduleAvailable:({sessionId})=>sessionId==='ready',resolve:()=>({blocks:[]}),parseText:(_c,r)=>({blocks:[{id:'text',type:'text',text:r.text}]})})
 assert.equal(registry.list({sessionId:'cold'})[0].moduleAvailable,false);assert.equal(registry.list({sessionId:'cold'})[0].acceptsText,true)
 assert.equal(registry.list({sessionId:'ready'})[0].moduleAvailable,true)
})


test('authored text never replaces the module used by another source reference',async()=>{
 const registry=new RequestSourceRegistry()
 registry.register({id:'parts',pluginId:'notes',name:'Parts',resolve:()=>({blocks:[{id:'part',type:'text',text:'SOURCE'}]}),parseText:(_c,r)=>({blocks:[{id:'part',type:'text',text:r.text}]})})
 registry.register({id:'consumer',pluginId:'notes',name:'Consumer',dependencies:['parts'],resolve:()=>({blocks:[{id:'ref',type:'reference',sourceId:'parts',blockIds:['part']}]})})
 const preset={format:FORMAT,version:1,name:'Text',rules:[{id:'authored',kind:'parts',inputMode:'text',role:'user',text:'AUTHORED'},{id:'consumer',kind:'consumer',role:'user'}]}
 const result=await assembleRequestAsync({registry,preset})
 assert.deepEqual(result.messages.map(m=>m.content[0].text),['AUTHORED','SOURCE'])
})
