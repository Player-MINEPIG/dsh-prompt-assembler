import test from 'node:test'
import assert from 'node:assert/strict'
import { assembleNative } from '../src/native-backend.js'
import { NATIVE_BUILTINS, createDefaultRegistry } from '../adapters/tavern.js'
import { normalizePreset } from '../src/model.js'
import { textOf } from '../src/assemble.js'

const msg = (id, role = 'user') => ({ id, role, content: [{ type: 'text', text: id }], source: { kind: role === 'user' ? 'user' : 'model' } })
const prompt = (identifier, role, content) => ({ identifier, name: identifier, role, content, enabled: true })
const base = placement => normalizePreset({ ...NATIVE_BUILTINS[0], placement })
async function plan(prompts, { placement = 'native-roles', history = [msg('OLD')], inputs = [msg('NOW')], rules, ...assets } = {}) {
  const preset = base(placement); if (rules) preset.rules = rules(preset.rules)
  const runtime = { registry: createDefaultRegistry(), resources: { compile: () => ({ assemblyInput: { ...assets, preset: { id: 'fixture', prompts } } }) } }
  return assembleNative(runtime, { preset, agent: { session: { deriveMessages: () => history } }, inputs, assembly: { sections: [], contexts: [], variables: {} }, preview: true })
}
test('role priority honors mixed preset entries despite a system module override, including jailbreak and referenced fields', async () => {
  const result = await plan([prompt('lead', 'user', 'LEAD'), prompt('sys', 'system', 'SYS'),
    { identifier: 'chatHistory', marker: true, enabled: true },
    { identifier: 'charDescription', marker: true, enabled: true, role: 'user' }, prompt('jailbreak', 'user', 'TAIL')], { character: { data: { description: 'CHAR' } } })
  assert.deepEqual(result.logical.messages.map(m => [m.role, textOf(m)]), [['system', 'SYS'], ['user', 'OLD'], ['user', 'NOW'], ['user', 'LEAD'], ['user', 'CHAR'], ['user', 'TAIL']])
  assert.deepEqual(result.assembly.contexts.length, 3)
  assert.equal(result.logical.nodes.find(n => n.name === 'lead').nativeDelivery, 'context')
})
test('role priority handles empty history/input without fabricating messages and accepts pre-step before input', async () => {
  const result = await plan([prompt('lead', 'user', 'LEAD')], { history: [], inputs: [], rules: rules => rules.map(r => r.kind === 'preset' ? { ...r, delivery: 'pre-step' } : r) })
  assert.deepEqual(result.beforeInput.map(textOf), ['LEAD'])
  assert.deepEqual(result.logical.messages.map(textOf), ['LEAD'])
  assert.deepEqual(result.logical.nodes.map(n => n.source.module), ['history', 'preset', 'input'])
})
test('adaptive ordering rejects authored assistant and reports approximated source depth by item name', async () => {
  await assert.rejects(plan([prompt('Assistant entry', 'assistant', 'A')]), /Assistant entry/)
  const depth = await plan([{ ...prompt('Depth entry', 'system', 'D'), injectionPosition: 1, injectionDepth: 2 }])
  assert.ok(depth.logical.diagnostics.some(d => d.code === 'NATIVE_DEPTH_APPROXIMATED' && d.name === 'Depth entry' && d.depth === 2))
  assert.deepEqual(depth.logical.messages.map(textOf), ['D','OLD','NOW'])
})

test('chatHistory slot brackets unchanged history/input, adapts roles, and leaves pre-step evidence', async () => {
  const result = await plan([prompt('open', 'user', 'OPEN'), { identifier: 'chatHistory', marker: true, enabled: true }, prompt('close', 'system', 'CLOSE')], { placement: 'native-slots' })
  assert.deepEqual(result.logical.messages.map(m => [m.role, textOf(m)]), [['system','OPEN'], ['user','OLD'], ['user','NOW'], ['user','CLOSE']])
  assert.deepEqual(result.afterInput.map(textOf), ['CLOSE'])
  assert.deepEqual(result.logical.diagnostics.filter(d => d.code === 'NATIVE_ROLE_ADJUSTED').map(d => [d.name,d.from,d.to]), [['open','user','system'], ['close','system','user']])
})
test('separate inline history/input macros bracket both native regions, including empty previews', async () => {
  for (const empty of [false,true]) {
    const result = await plan([prompt('wrapper','user','START{{history}}MIDDLE{{input}}END')], { placement:'native-slots', ...(empty ? {history:[],inputs:[]} : {}) })
    assert.deepEqual(result.logical.messages.map(textOf), empty ? ['START','MIDDLE','END'] : ['START','OLD','MIDDLE','NOW','END'])
    assert.deepEqual(result.beforeInput.map(textOf), ['MIDDLE']); assert.deepEqual(result.afterInput.map(textOf), ['END'])
    assert.deepEqual(result.logical.nodes.map(n => n.source.module), ['preset','history','preset','input','preset'])
  }
})
test('input-only and history-only macros retain a legal fallback anchor without duplicate native messages', async () => {
  const onlyInput = await plan([prompt('wrapper','user','BEFORE{{input}}AFTER')],{placement:'native-slots'})
  assert.deepEqual(onlyInput.logical.messages.map(textOf), ['OLD','BEFORE','NOW','AFTER'])
  const onlyHistory = await plan([prompt('wrapper','user','BEFORE{{history}}AFTER')],{placement:'native-slots'})
  assert.deepEqual(onlyHistory.logical.messages.map(textOf), ['BEFORE','OLD','AFTER','NOW'])
  await assert.rejects(plan([prompt('bad','user','{{input}}{{history}}')],{placement:'native-slots'}), /input precedes history/)
})
test('missing or disabled preset slots fall back to roles, and repeated macros do not duplicate history/input', async () => {
  const missing = await plan([prompt('prefix','user','USER'), prompt('suffix','system','SYSTEM')],{placement:'native-slots'})
  assert.deepEqual(missing.logical.messages.map(textOf), ['SYSTEM','OLD','NOW','USER'])
  assert.ok(missing.logical.diagnostics.some(d=>d.code==='NATIVE_SLOTS_ABSENT'))
  const repeated = await plan([prompt('p','user','A{{chatHistory}}B{{chatHistory}}C')],{placement:'native-slots'})
  assert.deepEqual(repeated.logical.messages.map(textOf), ['A','OLD','NOW','B','C'])
  const disabled = await plan([prompt('p','user','A{{chatHistory}}B')],{placement:'native-slots',rules:rules=>rules.map(r=>r.kind==='preset'?{...r,enabled:false}:r)})
  assert.deepEqual(disabled.logical.messages.map(textOf), ['OLD','NOW'])
})

test('opening previews do not add a synthetic assistant greeting to native history', async () => {
  const result = await plan([prompt('p', 'user', 'A{{chatHistory}}B')], { placement: 'native-slots', history: [], inputs: [], includeGreetingReference: true, character: { data: { firstMessage: 'REFERENCE ONLY' } } })
  assert.deepEqual(result.logical.messages.map(textOf), ['A', 'B'])
})

test('depth worldbook entries follow native priority without splitting tool history', async () => {
  const history = [msg('OLD'), { ...msg('call', 'assistant'), content: [{type:'tool-call', id:'c', name:'probe', arguments:'{}'}] }, { ...msg('result','tool'), toolCallId:'c', source:{kind:'tool',callId:'c'} }]
  const result = await plan([prompt('p','user','A{{chatHistory}}B')], { placement:'native-slots', history, loreEntries:[{id:'lore',comment:'Deep lore',content:'LORE',role:'system',requestedPosition:'at_depth',depth:2}] })
  assert.ok(result.logical.diagnostics.some(d=>d.code==='NATIVE_DEPTH_APPROXIMATED'&&d.name==='Deep lore'))
  assert.deepEqual(result.logical.messages.filter(m=>history.some(h=>h.id===m.id)),history)
  assert.deepEqual(result.afterInput.map(textOf),['B'])
  assert.equal(result.logical.messages.find(m=>textOf(m)==='LORE').role,'system')
})

test('pre-step source marks assembler injections without changing role, text or delivery regions', async () => {
  const result = await plan([prompt('wrapper','user','START{{history}}BEFORE{{input}}AFTER')], {placement:'native-slots'})
  assert.deepEqual(result.beforeInput.map(m=>[m.role,textOf(m)]), [['user','BEFORE']])
  assert.deepEqual(result.afterInput.map(m=>[m.role,textOf(m)]), [['user','AFTER']])
  for (const message of [...result.beforeInput,...result.afterInput]) {
    assert.equal(message.source.kind,'dsh-prompt-assembler')
    assert.equal(message.source.form,'instructions')
    assert.equal(message.source.delivery,'pre-step')
    assert.equal(message.source.ruleId,'preset')
  }
})

const moveLore = (rules, target, role = 'user') => {
  const lore = { ...rules.find(r => r.kind === 'worldbook'), role, delivery: 'pre-step' }
  const rest = rules.filter(r => r.kind !== 'worldbook')
  rest.splice(target === 'end' ? rest.length : rest.findIndex(r => r.kind === target), 0, lore)
  return rest
}
test('independent worldbook moves around native anchors without changing preset spine or roles', async () => {
  const prompts = [prompt('wrapper','user','OPEN{{history}}MIDDLE{{input}}CLOSE')]
  for (const target of ['history','input','end']) {
    const result = await plan(prompts,{placement:'native-slots', loreEntries:[{id:'l',content:'LORE'}],rules:rules=>moveLore(rules,target)})
    assert.deepEqual(result.logical.messages.map(textOf).filter(t=>t!=='LORE'),['OPEN','OLD','MIDDLE','NOW','CLOSE'])
    assert.equal(result.logical.messages.find(m=>textOf(m)==='LORE').role,'user')
    assert.ok(result.logical.placementControls.some(c=>c.ruleId==='worldbook'&&c.control==='independent'))
    if(target==='input') assert.deepEqual(result.beforeInput.map(textOf),['MIDDLE','LORE'])
    if(target==='end') assert.deepEqual(result.afterInput.map(textOf),['CLOSE','LORE'])
  }
  const system = await plan(prompts,{placement:'native-slots',loreEntries:[{id:'l',content:'LORE'}],rules:rules=>moveLore(rules,'end','system')})
  assert.deepEqual(system.logical.messages.map(textOf),['OPEN','LORE','OLD','MIDDLE','NOW','CLOSE'])
  assert.ok(!system.logical.diagnostics.some(d=>d.code==='NATIVE_ROLE_ADJUSTED'&&d.name==='worldbook:l'))
})
test('worldbook slots own only referenced groups; independent remainder remains movable', async () => {
  const prompts=[prompt('wrapper','user','OPEN{{worldInfoBefore}}{{history}}MIDDLE{{input}}CLOSE')]
  for(const target of ['preset','history','end']) {
    const result=await plan(prompts,{placement:'native-slots',loreEntries:[{id:'owned',position:'before',content:'OWNED'},{id:'free',position:'after',content:'FREE'}],rules:rules=>moveLore(rules,target)})
    assert.deepEqual(result.logical.messages.map(textOf).filter(t=>t!=='FREE'),['OPEN','OWNED','OLD','MIDDLE','NOW','CLOSE'])
    assert.equal(result.logical.nodes.find(n=>n.text==='OWNED').placementSource,'preset')
    assert.equal(result.logical.nodes.find(n=>n.text==='OWNED').role,'system')
    assert.equal(result.logical.placementControls.find(c=>c.ruleId==='worldbook').control,'mixed')
  }
})
test('a competing custom reference cannot steal native slots by moving ahead of the preset', async()=>{
  const result=await plan([prompt('wrapper','user','OPEN{{chatHistory}}CLOSE')],{placement:'native-slots',rules:rules=>[{id:'custom',kind:'custom',enabled:true,role:'system',lifetime:'request',text:'{{chatHistory}}'},...rules]})
  assert.deepEqual(result.logical.messages.map(textOf),['OPEN','OLD','NOW','CLOSE'])
  assert.equal(result.logical.nodes.find(n=>n.source.module==='history').placementSource,'preset')
})

test('before/after slots bracket character fields and never claim depth entries', async () => {
  const prompts = [{identifier:'worldInfoBefore',marker:true,enabled:true,role:'system'},
    {identifier:'charDescription',marker:true,enabled:true,role:'system'},
    {identifier:'worldInfoAfter',marker:true,enabled:true,role:'system'},
    {identifier:'chatHistory',marker:true,enabled:true}, prompt('close','user','CLOSE')]
  const assets={character:{data:{description:'CHAR'}},loreEntries:[
    {id:'before',position:'before',requestedPosition:'before_character_definition',content:'BEFORE'},
    {id:'after',position:'after',requestedPosition:'after_character_definition',content:'AFTER'},
    {id:'depth',position:'after',requestedPosition:'at_depth',depth:1,role:'user',content:'DEPTH'}]}
  for (const placement of ['native-slots','native-roles']) {
    const result=await plan(prompts,{...assets,placement,rules:rules=>rules.map(r=>r.kind==='worldbook'?{...r,role:'preserve'}:r)})
    assert.deepEqual(result.logical.nodes.filter(n=>['BEFORE','CHAR','AFTER'].includes(n.text)).map(n=>n.text),['BEFORE','CHAR','AFTER'])
    assert.equal(result.logical.nodes.find(n=>n.text==='DEPTH').placementSource,null)
    assert.equal(result.logical.nodes.find(n=>n.text==='DEPTH').role,placement === 'native-slots' ? 'system' : 'user')
    assert.equal(result.logical.placementControls.find(c=>c.ruleId==='worldbook').control,placement === 'native-slots' ? 'preset' : 'mixed')
  }
  const {assembleRequest}=await import('../src/assemble.js')
  const {BUILTINS}=await import('../adapters/tavern.js')
  const result=assembleRequest({registry:createDefaultRegistry(),preset:BUILTINS[0],assets:{...assets,preset:{prompts}},nativeMessages:[msg('OLD'),msg('NOW')],inputIds:['NOW']})
  assert.deepEqual(result.messages.map(textOf),['BEFORE','CHAR','AFTER','OLD','DEPTH','NOW','CLOSE'])
  assert.equal(result.nodes.find(n=>n.text==='DEPTH').role,'user')
})

const marker = (identifier, role = 'system') => ({ identifier, role, marker: true, enabled: true })
const lore = (id, requestedPosition, role = 'system', extra = {}) => ({ id, comment: id, content: id, requestedPosition, position: requestedPosition.startsWith('before') ? 'before' : 'after', role, ...extra })
test('all six worldbook positions follow preset slots, adapt roles, and survive module movement', async () => {
  const prompts = [marker('worldInfoBefore'), marker('charDescription'), marker('worldInfoAfter'),
    prompt('split','user','{{history}}'), marker('dialogueExamples'), prompt('authorNote','system','NOTE'), prompt('inputSlot','user','{{input}}')]
  const loreEntries = [lore('CB','before_character_definition','user'), lore('CA','after_character_definition','assistant'),
    lore('EB','before_example_messages'), lore('EA','after_example_messages'), lore('NB','before_author_note'), lore('NA','after_author_note')]
  for (const target of ['preset','history','end']) {
    const result = await plan(prompts,{placement:'native-slots',loreEntries,character:{data:{description:'CHAR',messageExample:'EXAMPLES'}},rules:rs=>moveLore(rs,target)})
    assert.deepEqual(result.logical.messages.map(textOf),['CB','CHAR','CA','OLD','EB','EXAMPLES','EA','NB','NOTE','NA','NOW'])
    assert.deepEqual(result.logical.messages.map(m=>m.role),['system','system','system',...Array(8).fill('user')])
    assert.ok(result.logical.nodes.filter(n=>n.source.module==='worldbook').every(n=>n.placementSource==='preset'))
    assert.equal(result.logical.placementControls.find(c=>c.ruleId==='worldbook').control,'preset')
  }
})
test('worldbook slots exist around empty anchors and warn when an anchor is disabled or absent', async () => {
  const entries=[lore('EB','before_example_messages'),lore('EA','after_example_messages'),lore('NB','before_author_note'),lore('NA','after_author_note')]
  const present=await plan([marker('dialogueExamples'),marker('authorNote'),marker('chatHistory')],{placement:'native-slots',loreEntries:entries})
  assert.deepEqual(present.logical.messages.map(textOf),['EB','EA','NB','NA','OLD','NOW'])
  for (const prompts of [[],[{...marker('authorNote'),enabled:false}]]) {
    const missing=await plan(prompts,{placement:'native-slots',loreEntries:entries})
    assert.equal(missing.logical.diagnostics.filter(d=>d.code==='WORLD_BOOK_SLOT_MISSING').length,4)
    assert.equal(missing.logical.nodes.filter(n=>n.source.module==='worldbook').length,4)
  }
})
test('slot depth zero/one maps around history without splitting it; larger source depths remain approximate', async () => {
  const loreEntries=[lore('D0','at_depth','system',{depth:0}),lore('D1','at_depth','user',{depth:1}),lore('D2','at_depth','system',{depth:2})]
  for (const empty of [false,true]) for (const target of ['preset','end']) {
    const result=await plan([prompt('p','user','OPEN{{history}}BETWEEN{{input}}CLOSE')],{placement:'native-slots',loreEntries,rules:rs=>moveLore(rs,target,'preserve'),...(empty?{history:[],inputs:[]}: {})})
    const texts=result.logical.messages.map(textOf)
    assert.deepEqual(texts.filter(t=>t!=='D2'),empty?['OPEN','D1','D0','BETWEEN','CLOSE']:['OPEN','D1','OLD','D0','BETWEEN','NOW','CLOSE'])
    assert.deepEqual(result.logical.nodes.filter(n=>n.nativeDepthAnchor).map(n=>[n.text,n.role,n.nativeDepthAnchor]),[['D1','system','before-history'],['D0','user','after-history']])
    assert.deepEqual(result.logical.diagnostics.filter(d=>d.code==='NATIVE_DEPTH_APPROXIMATED').map(d=>d.depth),[2])
    assert.deepEqual(result.beforeInput.map(textOf),['D0','BETWEEN'])
    assert.equal(result.logical.placementControls.find(c=>c.ruleId==='worldbook').control,'mixed')
  }
  const noSlots=await plan([],{placement:'native-slots',loreEntries:loreEntries.slice(0,2)})
  assert.deepEqual(noSlots.logical.messages.map(textOf),['D1','OLD','D0','NOW'])
})
test('roles first keeps worldbook roles and slot order ahead of module placement', async () => {
  const prompts=[prompt('lead','user','LEAD'),marker('worldInfoBefore','system'),prompt('middle','user','MID'),marker('worldInfoAfter','user'),marker('dialogueExamples','user'),prompt('authorNote','user','NOTE')]
  const loreEntries=[lore('A1','after_character_definition','user'),lore('B1','before_character_definition','user'),lore('B2','before_character_definition','user'),lore('AS','after_character_definition','system'),lore('EB','before_example_messages','user'),lore('EA','after_example_messages','user'),lore('NB','before_author_note','user'),lore('NA','after_author_note','user')]
  for(const target of ['preset','end']) {
    const result=await plan(prompts,{loreEntries,rules:rs=>moveLore(rs,target,'system').map(r=>({...r,delivery:'context'}))})
    assert.deepEqual(result.logical.messages.map(textOf),['AS','OLD','NOW','LEAD','B1','B2','MID','A1','EB','EA','NB','NOTE','NA'])
    assert.equal(result.logical.nodes.find(n=>n.text==='AS').role,'system')
    assert.ok(result.logical.nodes.filter(n=>n.source.module==='worldbook'&&n.text!=='AS').every(n=>n.role==='user'))
  }
})
