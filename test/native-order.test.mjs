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
  assert.deepEqual(result.afterInput.map(textOf),['B','LORE'])
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
