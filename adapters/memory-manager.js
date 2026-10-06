import {contentGuides} from './content-guides.js'
import {createHash} from 'node:crypto'
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const SOURCE_ID='memory-manager.resources'
export function registerRequestSource(manager,registry,usage){
 if(registry.version!==1)throw Error('Unsupported assembler source protocol')
 return registry.register({id:SOURCE_ID,pluginId:'dsh-memory-manager',name:'记忆管理资源',contentGuide:contentGuides[SOURCE_ID],version:1,lifetimes:['request'],moduleAvailable:()=>{const r=manager.requestAssemblyResources();return r.available&&r.entries.length>0},resolve:async context=>{
  const resources=manager.requestAssemblyResources()
  if(!resources.available)return {blocks:[],diagnostics:[{code:'MEMORY_CONFIG_UNAVAILABLE'}]}
  const blocks=[],diagnostics=[]
  for(const entry of resources.entries){
   const snapshot=entry.configurationSnapshot
   try {
   const result=await usage.trigger({id:entry.id,configurationSnapshot:snapshot,mode:'retrieve',preview:true,signal:context.signal,event:{on:'before_model_request',eventId:'readonly-resolver',scope:{sessionId:context.sessionId},turn:context.turn,step:context.step,nativeMessages:context.nativeMessages}})
   if(!result.matched)continue
   const text=typeof result.value==='string'?result.value:result.value?.text
   if(typeof text!=='string'||!text)continue
   const tuple={entityId:entry.id,resourceRevision:result.resourceRevision,configRevision:snapshot.revision,strategyRevision:result.strategyRevision}
   const blockId='v1-'+hash(tuple)
   blocks.push({id:blockId,type:'text',text,role:'system',source:{resourceId:entry.id,field:'content'}})
   diagnostics.push({code:'MEMORY_RESOURCE_VERSION',blockId,adapterId:entry.adapterId,...tuple})
   }catch(error){context.signal?.throwIfAborted();diagnostics.push({code:'MEMORY_RESOURCE_UNAVAILABLE',adapterId:entry.adapterId,entityId:entry.id,reason:error.code??'SOURCE_ERROR',message:error.message})}
  }
  return {blocks,diagnostics}
 }})
}
export function observeTavernRequest(manager,session,options){
 const request=session?.snapshotEvents?.().findLast(e=>e.type==='request/assembly'),data=request?.data
 if(!data||!['pmp-dsh-tavern','dsh-prompt-assembler'].includes(data.metadata?.owner)||hash(data.messages)!==hash(options.messages))return
 const assembly=data.metadata.assembly
 if(assembly.preview)return
 const facts=assembly.diagnostics?.filter(d=>d.code==='MEMORY_RESOURCE_VERSION')??[]
 const flatten=nodes=>nodes.flatMap(n=>[n,...flatten(n.children??[])])
 const nodes=flatten(assembly.nodes??[])
 for(const fact of facts){
  const node=nodes.find(n=>n.source?.sourceId===SOURCE_ID&&n.source.resourceId===fact.entityId&&(n.id.endsWith(':'+fact.blockId)||n.name===fact.blockId))
  if(!node)continue
  const requestId=`${session.id}:${request.seq}`
  manager.recordTrace({adapterId:fact.adapterId,id:fact.entityId,eventId:requestId,requestId,phase:'applied',sessionId:session.id,turn:data.turn,turnKind:'unknown',revision:fact.resourceRevision,configRevision:fact.configRevision,strategyRevision:fact.strategyRevision,detail:'已进入 DSH 请求（llm/stream 观察；不代表网络送达）'})
 }
}

export function connectMemoryManager(ctx, registry) {
  return ctx.inject(['dshMemoryManager'], scope => {
    const manager = scope.get('dshMemoryManager')
    if (typeof manager.requestAssemblyResources !== 'function') throw new TypeError('Memory Manager request assembly resources protocol is unavailable')
    scope.effect(() => { const stop = registerRequestSource(manager, registry, { trigger: manager.trigger }); manager.requestSourceAvailable = true; return () => { manager.requestSourceAvailable = false; stop() } })
    scope.on('llm/stream', async function*(options, next) {
      const session = scope.get('agents')?.get(options.sessionId)?.session
      try { observeTavernRequest(manager, session, options) } catch (error) { manager.diagnostics.push({ code: 'REQUEST_OBSERVATION_FAILED', message: error.message }) }
      yield* next()
    })
  })
}
