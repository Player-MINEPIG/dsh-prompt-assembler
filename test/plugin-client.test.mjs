import {DEFAULT_HISTORY_POLICY} from '../src/history/schema.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHTML } from 'linkedom'
import { build } from 'esbuild'
import { AssemblyPanel, moveSlotRule } from '../src/client.js'
import { AssemblyOverlay, AssemblySettingsEntry, apply, createAssemblyController, createSessionWithPreset, inject, mainSession, name, sessionLabel } from '../src/plugin-client.js'

const json = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
const deferred = () => { let resolve; return { promise: new Promise(r => { resolve = r }), resolve: value => resolve(value) } }
function source(snapshot) {
  const listeners = new Set()
  return { getSnapshot: () => snapshot, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) }, set: value => { snapshot = value; for (const fn of listeners) fn() }, get listeners() { return listeners.size } }
}
const catalog = (...rows) => ({ byId: Object.fromEntries(rows.map(row => [row.id, row])), ids: rows.map(r => r.id), phase: 'ready' })
const row = (id, mainView = 1) => ({ id, title: `Session ${id}`, blank: false, retainedBy: { mainView } })

test('entry registers a settings navigation entry and guarded overlay without a session header shortcut or Tavern', () => {
  assert.equal(name, 'dsh-prompt-assembler')
  assert.deepEqual(inject, ['slots', 'sessions', 'workspaces', 'uiWorkspace'])
  const entries = [], cleanups = []
  const ctx = { sessions: { list: source(catalog()) }, workspaces: {}, uiWorkspace: {}, effect: fn => cleanups.push(fn()), slots: {
    inject: (slot, fn) => { fn() }, register: (entry, component) => { entries.push({ ...entry, component }); return () => {} },
  } }
  apply(ctx)
  assert.deepEqual(entries.map(e => e.name), ['settings.section', 'shell.overlay'])
  assert.equal(entries[0].inject().assembler.getSnapshot().open, false)
  cleanups.forEach(fn => fn())
  assert.equal(ctx.sessions.list.listeners, 0)
})

test('main-view identity excludes retained background sessions and preserves blank IDs', () => {
  const background = { ...row('background', 0), retainedBy: { diagnostics: 1 } }
  assert.equal(mainSession(catalog(background)), null)
  const blank = { ...row('blank'), blank: true }
  assert.equal(mainSession(catalog(background, blank)).id, 'blank')
  assert.equal(sessionLabel(blank, 'en'), 'New Session')
  assert.equal(sessionLabel(row('active'), 'en'), 'Session active')
})

test('guarded native navigation retains the old binding until confirmation and rejects stale prompts', async () => {
  const list = source(catalog(row('a'))), controller = createAssemblyController({ list })
  await controller.open()
  const first = deferred(), second = deferred()
  let prompts = 0
  controller.registerBeforeLeave(() => (++prompts === 1 ? first : second).promise)
  list.set(catalog(row('b')))
  assert.equal(controller.getSnapshot().session.id, 'a')
  list.set(catalog(row('c')))
  first.resolve(true); await first.promise; await Promise.resolve()
  assert.equal(controller.getSnapshot().session.id, 'a')
  second.resolve(false); await second.promise; await Promise.resolve()
  assert.equal(controller.getSnapshot().session.id, 'a')
  controller.registerBeforeLeave(() => true)
  await controller.open()
  assert.equal(controller.getSnapshot().session.id, 'c')
  controller.dispose()
  assert.equal(list.listeners, 0)
})

test('creation applies selection before native navigation, and never navigates on failure', async () => {
  const calls = []
  const options = { workspaceId: 'w', presetId: 'p', sessions: { create: async request => { calls.push(['create', request]); return 'new' } }, uiWorkspace: { openSession: async id => calls.push(['open', id]) }, fetcher: async (url, request) => { calls.push(['selection', JSON.parse(request.body)]); return json({ ok: true }) } }
  assert.equal(await createSessionWithPreset(options), 'new')
  assert.deepEqual(calls, [['create', { workspaceId: 'w' }], ['selection', { sessionId: 'new', id: 'p' }], ['open', 'new']])
  calls.length = 0
  await assert.rejects(createSessionWithPreset({ ...options, fetcher: async () => new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 }) }), /unavailable/)
  assert.deepEqual(calls, [['create', { workspaceId: 'w' }]])
  calls.length = 0
  await assert.rejects(createSessionWithPreset({ ...options, workspaceId: '' }), /Choose a workspace/)
  assert.deepEqual(calls, [])
})

test('disposed or superseded editor cannot navigate after asynchronous creation', async () => {
  const pending = deferred(), calls = []
  let current = true
  const completion = createSessionWithPreset({ workspaceId: 'w', presetId: 'p', sessions: { create: () => pending.promise }, uiWorkspace: { openSession: () => calls.push('open') }, fetcher: () => calls.push('selection'), isCurrent: () => current })
  current = false; pending.resolve('new')
  await assert.rejects(completion, { name: 'AbortError' })
  assert.deepEqual(calls, [])
})

function dom() {
  const { window } = parseHTML('<html><body><div id="root"></div></body></html>')
  const previous = Object.fromEntries(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, globalThis[key]]))
  globalThis.window = window; globalThis.document = window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const root = createRoot(window.document.getElementById('root'))
  return { root, document: window.document, async close() { await act(async () => root.unmount()); for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value } } }
}
const preset = { historyPolicy: DEFAULT_HISTORY_POLICY, id: 'p', name: 'Strategy', builtin: false, placement: 'modules', rules: [] }
const library = { presets: [preset], defaultPresetId: 'p', selection: null, capability: true, sources: [] }
const button = (document, label) => [...document.querySelectorAll('button')].find(node => node.textContent === label)

test('withdrawn provider preset keeps its applied snapshot notice without a builtin ID prefix', async () => {
  const ui = dom()
  try {
    await act(async () => ui.root.render(h(AssemblyPanel, { standalone: true, sessionId: 's', locale: 'en', close() {}, fetcher: async () => json({ ...library, selection: { ...preset, id: 'vendor-choice', name: 'Applied provider snapshot' } }) })))
    assert.match(ui.document.body.textContent, /Applied provider snapshot/)
    assert.match(ui.document.body.textContent, /strategy is no longer in the current catalog/)
    assert.match(ui.document.body.textContent, /retains its applied configuration/)
  } finally { await ui.close() }
})

test('mounted panel saves a new dirty draft before creating, with no active session', async () => {
  const ui = dom(), calls = []
  try {
    const fetcher = async (url, options) => {
      if (options.method === 'POST') { calls.push(['save', JSON.parse(options.body)]); return json({ preset: { ...preset, id: 'saved' } }) }
      return json(library)
    }
    await act(async () => ui.root.render(h(AssemblyPanel, { standalone: true, locale: 'en', sessionLabel: 'New Session', close() {}, fetcher, onCreateSession: async id => calls.push(['create', id]) })))
    assert.match(ui.document.querySelector('[data-assembly-session]').textContent, /New Session/)
    assert.equal(button(ui.document, 'Save and apply to this session').disabled, true)
    assert.equal(button(ui.document, 'Create a session with this strategy').disabled, false)
    await act(async () => button(ui.document, 'Create').click())
    await act(async () => button(ui.document, 'Create a session with this strategy').click())
    assert.equal(calls[0][0], 'save')
    assert.deepEqual(calls[1], ['create', 'saved'])
  } finally { await ui.close() }
})

test('mounted overlay demands a workspace choice when multiple are available', async () => {
  const ui = dom(), list = source(catalog()), assembler = createAssemblyController({ list }), calls = []
  try {
    await assembler.open()
    await act(async () => ui.root.render(h(AssemblyOverlay, { assembler, sessions: { list, create: async request => { calls.push(request); return 'new' } }, workspaces: { list: source({ phase: 'ready', items: [{ workspaceId: 'a', title: 'A' }, { workspaceId: 'b', title: 'B' }] }) }, uiWorkspace: { openSession() {} }, fetcher: async () => json(library) })))
    const picker = ui.document.querySelector('select[aria-label="New session workspace"]') ?? ui.document.querySelector('select[aria-label="新会话工作区"]')
    assert.equal(picker.querySelector('option').value, '')
    await act(async () => (button(ui.document, 'Create a session with this strategy') ?? button(ui.document, '使用此策略新建会话')).click())
    assert.deepEqual(calls, [])
    assert.match(ui.document.querySelector('[role="alert"]').textContent, /Choose a workspace/)
  } finally { await ui.close(); assembler.dispose() }
})

test('mounted dirty editor prompts on native navigation and cancellation keeps writes bound to the opening session', async () => {
  const ui = dom(), list = source(catalog(row('a'))), assembler = createAssemblyController({ list }), selections = []
  try {
    await assembler.open()
    const fetcher = async (url, options) => {
      if (url.endsWith('/preview')) return json({preview:{nodes:[],messages:[],diagnostics:[]}})
      if (options.method === 'POST') return json({ preset: { ...preset, id: 'saved' } })
      if (options.method === 'PUT') { selections.push(JSON.parse(options.body)); return json({ selection: { id: 'saved', name: 'Strategy' } }) }
      return json(library)
    }
    await act(async () => ui.root.render(h(AssemblyOverlay, { assembler, sessions: { list }, workspaces: { list: source({ phase: 'ready', items: [] }) }, uiWorkspace: {}, fetcher })))
    await act(async () => (button(ui.document, 'Create') ?? button(ui.document, '创建')).click())
    await act(async () => list.set(catalog(row('b'))))
    assert.ok(ui.document.querySelector('[role="alertdialog"]'))
    assert.equal(ui.document.querySelector('[data-assembly-session]').getAttribute('data-assembly-session'), 'a')
    await act(async () => (button(ui.document, 'Cancel') ?? button(ui.document, '取消')).click())
    await act(async () => (button(ui.document, 'Save and apply to this session') ?? button(ui.document, '保存并应用到当前会话')).click())
    assert.deepEqual(selections, [{ sessionId: 'a', id: 'saved' }])
    assert.equal(ui.document.querySelector('[data-assembly-session]').getAttribute('data-assembly-session'), 'a')
    await act(async () => assembler.open())
    assert.equal(ui.document.querySelector('[data-assembly-session]').getAttribute('data-assembly-session'), 'b')
  } finally { await ui.close(); assembler.dispose() }
})

test('session remount ignores a delayed old-session save and actual viewer uses standalone API', async () => {
  const ui = dom(), pending = deferred(), calls = []
  try {
    const fetcher = async (url, options) => {
      calls.push(url)
      if (options.method === 'PUT') return pending.promise
      if (url.includes('/actual?')) return json({ request: { messages: [{ role: 'user', content: [{ type: 'text', text: 'Actual B' }] }], metadata: {} } })
      return json(library)
    }
    const props = { standalone: true, locale: 'en', close() {}, fetcher }
    await act(async () => ui.root.render(h(AssemblyPanel, { ...props, sessionId: 'a' })))
    await act(async () => { button(ui.document, 'Save rules').click() })
    await act(async () => ui.root.render(h(AssemblyPanel, { ...props, sessionId: 'b' })))
    await act(async () => pending.resolve(json({ preset: { ...preset, name: 'Late A' } })))
    assert.equal(ui.document.querySelector('input[value="Late A"]'), null)
    await act(async () => button(ui.document, 'View latest actual request').click())
    assert.ok(calls.some(url => url.endsWith('/actual?sessionId=b')))
    assert.match(ui.document.body.textContent, /Actual B/)
  } finally { await ui.close() }
})

test('browser bundle keeps React external and has no Tavern client dependency', async () => {
  const result = await build({ entryPoints: [new URL('../src/plugin-client.js', import.meta.url).pathname], bundle: true, format: 'cjs', platform: 'browser', target: 'es2022', write: false, external: ['react', '@deepseek-ai/*'], metafile: true })
  assert.match(result.outputFiles[0].text, /require\("react"\)/)
  assert.ok(Object.keys(result.metafile.inputs).every(path => !path.includes('/tavern/')))
})

 test('opening draft previews are enabled without a Session and do not mistake absent input for an invalid request', async () => {
  const ui = dom(), calls = []
  const target = {id:'draft', getSelection:async()=>null, previewAssembly:async current=>{
    calls.push(current)
    return {preview:{scope:'opening-draft',nodes:[],messages:[],diagnostics:[{code:'ASSEMBLY_SYSTEM_ONLY'}]}}
  }}
  try {
    await act(async()=>ui.root.render(h(AssemblyPanel,{selectionTarget:target,standalone:true,locale:'en',close(){},fetcher:async()=>json(library)})))
    assert.equal(button(ui.document,'Assembly result').disabled,false)
    assert.equal(button(ui.document,'View latest actual request').disabled,true)
    await act(async()=>button(ui.document,'Assembly result').click())
    assert.equal(calls.length,1);assert.equal(calls[0].id,preset.id)
    assert.match(ui.document.body.textContent,/opening draft’s logical order/)
    assert.equal(ui.document.querySelector('[role="alert"]'),null)
  } finally {await ui.close()}
 })

test('standard real session actual button reads native requests through the same API', async () => {
  const ui = dom(), calls = []
  try {
    const fetcher = async url => {
      calls.push(url)
      if (url.includes('/actual?')) return json({ backend: 'native', request: { messages: [{ role: 'user', content: [{ type: 'text', text: 'NATIVE ACTUAL' }] }], metadata: { backend: 'native' } } })
      return json({ ...library, selection: { ...preset, backend: 'native' } })
    }
    await act(async () => ui.root.render(h(AssemblyPanel, { sessionId: 'real', standalone: true, locale: 'en', fetcher })))
    assert.equal(button(ui.document, 'View latest actual request').disabled, false)
    await act(async () => button(ui.document, 'View latest actual request').click())
    assert.ok(calls.some(url => url.endsWith('/actual?sessionId=real')))
    assert.match(ui.document.body.textContent, /NATIVE ACTUAL/)
    assert.match(ui.document.body.textContent, /This is the recorded request/)
  } finally { await ui.close() }
})

test('legacy trace-root embedding can display verified native request details', async () => {
  const ui = dom()
  try {
    const fetcher = async url => {
      if (url.endsWith('/assemblies')) return json({ records: [{ id: 'native' }] })
      if (url.endsWith('/assemblies/native')) return json({ record: { nativeRequest: { messages: [{ role: 'user', content: [{ type: 'text', text: 'NATIVE TRACE' }] }] } } })
      return json({ ...library, selection: { ...preset, backend: 'native' } })
    }
    await act(async () => ui.root.render(h(AssemblyPanel, { sessionId: 'real', traceRoot: '/trace', standalone: true, locale: 'en', fetcher })))
    await act(async () => button(ui.document, 'View latest actual request').click())
    assert.match(ui.document.body.textContent, /NATIVE TRACE/)
  } finally { await ui.close() }
})

test('native actual view displays recorded source names and explicitly marks missing names', async () => {
  const ui=dom()
  try {
    const source={plugin:'pmp-dsh-tavern',module:'preset',resourceId:'old-preset',field:'main'}
    const nodes=[{id:'main',name:'Recorded opening rules',module:'preset',role:'system',source,sourceStatus:'recorded',text:'OLD BODY',stability:'snapshot',lifetime:'native'},
      {id:'old',name:'preset:custom-id',module:'preset',role:'system',source:{...source,field:'custom-id'},sourceStatus:'name-unrecorded',text:'OLDER BODY',stability:'snapshot',lifetime:'native'},
      {id:'current',name:'Readable preset item',module:'preset',role:'system',source:{...source,field:'uuid-field'},sourceStatus:'current-name',text:'HISTORICAL BODY',stability:'snapshot',lifetime:'native'}]
    const fetcher=async url=>url.includes('/actual?')?json({request:{messages:[{role:'system',content:[{type:'text',text:'OLD BODY'}]}],metadata:{assembly:{backend:'native',nodes,diagnostics:[]}}}}):json({...library,selection:{...preset,backend:'native'}})
    await act(async()=>ui.root.render(h(AssemblyPanel,{sessionId:'real',standalone:true,locale:'en',fetcher})))
    await act(async()=>button(ui.document,'View latest actual request').click())
    assert.match(ui.document.body.textContent,/Recorded opening rules/)
    assert.match(ui.document.body.textContent,/Original item name not recorded/)
    assert.match(ui.document.body.textContent,/Readable preset item/)
    assert.match(ui.document.body.textContent,/Name from the current preset; body from the recorded request/)
    assert.ok(!ui.document.body.textContent.includes('uuid-field'))
    assert.match(ui.document.body.textContent,/Preset content · 2/)
    assert.ok(!ui.document.querySelector('.dta-summary').textContent.includes('custom-id'))
    assert.match(ui.document.body.textContent,/Request messages \(1\)/)
    assert.ok(!ui.document.body.textContent.includes('Logical order (1)'))
    await act(async()=>ui.document.querySelector('[role="button"][title="Recorded opening rules"]').click())
    assert.match(ui.document.body.textContent,/old-preset \/ main/)
    assert.match(ui.document.body.textContent,/OLD BODY/)
  }finally{await ui.close()}
})

test('unannotated system messages no longer pretend to be official base instructions', async () => {
  const ui=dom()
  try {
    const fetcher=async url=>url.includes('/actual?')?json({request:{messages:[{role:'system',content:[{type:'text',text:'UNATTRIBUTED'}]}],metadata:{}}}):json(library)
    await act(async()=>ui.root.render(h(AssemblyPanel,{sessionId:'real',standalone:true,locale:'en',fetcher})))
    await act(async()=>button(ui.document,'View latest actual request').click())
    assert.match(ui.document.body.textContent,/Source not recorded/)
    assert.ok(!ui.document.body.textContent.includes('Native instructions'))
  }finally{await ui.close()}
})

test('native panel exposes role/slot modes, saves the selected mode and displays role adjustments', async () => {
  const { NATIVE_BUILTINS } = await import('../adapters/tavern.js')
  const ui = dom(), saved = [], draft = { ...NATIVE_BUILTINS.find(p => p.placement === 'native-roles'), id: 'test', builtin: false, historyPolicy: DEFAULT_HISTORY_POLICY }
  try {
    const fetcher = async (url, options) => {
      if (url.endsWith('/preview')) return json({ preview: { backend: 'native', nodes: [], messages: [], diagnostics: [{ code: 'NATIVE_ROLE_ADJUSTED', name: 'Opening', from: 'user', to: 'system' }] } })
      if (options.method === 'POST' || options.method === 'PUT') { saved.push(JSON.parse(options.body)); return json({ preset: draft }) }
      return json({ ...library, presets: [draft], defaultPresetId: draft.id, capabilities: { native: true, core: false } })
    }
    await act(async () => ui.root.render(h(AssemblyPanel, { standalone: true, locale: 'en', sessionId: 'test', close() {}, fetcher })))
    const select = [...ui.document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'native-slots'))
    assert.deepEqual([...select.options].map(o => o.value), ['modules', 'native-roles', 'native-slots'])
    await act(async () => { select.options[2].selected = true; select.dispatchEvent(new window.Event('change', { bubbles: true })) })
    await act(async () => button(ui.document, 'Save rules').click())
    assert.equal(saved[0].placement, 'native-slots')
    await act(async () => button(ui.document, 'Assembly result').click())
    assert.match(ui.document.body.textContent, /Opening · Role adjusted: user → system/)
  } finally { await ui.close() }
})

test('slot drag keeps mode and preset-owned rows fixed while moving independent content',async()=>{
  const {NATIVE_BUILTINS}=await import('../adapters/tavern.js')
  const draft=structuredClone(NATIVE_BUILTINS.find(p=>p.placement==='native-slots'))
  const at=draft.rules.findIndex(r=>r.kind==='worldbook')
  const preview={placementControls:[{ruleId:'preset',control:'preset'},{ruleId:'worldbook',control:'mixed'}],nodes:[{ruleId:'worldbook',role:'system',source:{module:'worldbook'}}]}
  assert.throws(()=>moveSlotRule(draft,preview,at,draft.rules.length),/system/)
  draft.rules[at].role='user';draft.rules[at].delivery='pre-step';preview.nodes[0].role='user'
  const moved=moveSlotRule(draft,preview,at,draft.rules.length)
  assert.equal(moved.at(-1).kind,'worldbook')
  assert.equal(draft.placement,'native-slots')
  assert.deepEqual(moved.filter(r=>r.kind!=='worldbook'),draft.rules.filter(r=>r.kind!=='worldbook'))
  assert.throws(()=>moveSlotRule(draft,preview,1,0),/preset-controlled/)
  assert.throws(()=>moveSlotRule(draft,preview,at,0),/user/)
})
test('source configuration resolves ownership without presenting sources as draggable blocks', async()=>{
  const {NATIVE_BUILTINS}=await import('../adapters/tavern.js')
  const ui=dom(),draft=structuredClone(NATIVE_BUILTINS.find(p=>p.placement==='native-slots'))
  delete draft.layout // Exercise compatibility rendering for an already-applied legacy snapshot.
  const controls={preset:'preset',persona:'preset',character:'mixed',worldbook:'independent',phi:'empty',history:'native',input:'native','native-system':'independent'}
  try{
    const fetcher=async(url)=>url.endsWith('/preview')?json({preview:{nodes:[],messages:[],diagnostics:[],placementControls:draft.rules.map(r=>({ruleId:r.id,control:controls[r.kind]}))}}):json({...library,presets:[draft],sources:[]})
    await act(async()=>ui.root.render(h(AssemblyPanel,{standalone:true,locale:'en',sessionId:'test',fetcher})))
    const rows=[...ui.document.querySelectorAll('[data-assembly-index]')]
    for(const [i,rule]of draft.rules.entries()){
      assert.equal(rows[i].querySelector('[data-placement-control]').getAttribute('data-placement-control'),controls[rule.kind])
      assert.equal(rows[i].querySelector('.dta-handle'), null)
    }
  }finally{await ui.close()}
})

test('context controls appear for legacy strategies and persist master/child switches without changing normal rules', async () => {
  const { Simulate } = await import('react-dom/test-utils')
  const { createDshRegistry } = await import('../adapters/dsh.js')
  const { BUILTINS } = await import('../src/model.js')
  const ui=dom(), saved=[]
  const original={...structuredClone(BUILTINS[0]),id:'legacy',builtin:false}
  try {
    const fetcher=async(url,options)=>{
      if(url.includes('/history-policy')) return json({ok:true,policy:DEFAULT_HISTORY_POLICY,revision:0})
      if(options.method==='PUT') { const p=JSON.parse(options.body); saved.push(p); return json({preset:{...p,id:'legacy'}}) }
      return json({...library,presets:[original],defaultPresetId:'legacy',sources:createDshRegistry().list(),capabilities:{native:true,core:false}})
    }
    await act(async()=>ui.root.render(h(AssemblyPanel,{standalone:true,locale:'en',sessionId:'s',fetcher})))
    const controls=[...ui.document.querySelectorAll('[data-context-control]')]
    assert.equal(controls.length,3)
    const master=ui.document.querySelector('[data-context-control="dsh.runtime-context"] input')
    const approval=ui.document.querySelector('[data-context-control="dsh.approval-policy"] input')
    assert.equal(master.checked,true);assert.equal(approval.checked,true)
    await act(()=>Simulate.change(master,{target:{checked:false}}))
    assert.equal(approval.checked,true,'master does not erase child preferences')
    await act(()=>Simulate.change(approval,{target:{checked:false}}))
    await act(async()=>button(ui.document,'Save rules').click())
    assert.equal(saved.length,1)
    assert.deepEqual(saved[0].rules.slice(0,original.rules.length),original.rules)
    assert.equal(saved[0].rules.find(r=>r.kind==='dsh.runtime-context').enabled,false)
    assert.equal(saved[0].rules.find(r=>r.kind==='dsh.approval-policy').enabled,false)
    assert.equal(saved[0].rules.find(r=>r.kind==='dsh.sandbox-policy').enabled,true)
  } finally {await ui.close()}
})

async function dragRow(document, handle, target) {
  const { Simulate } = await import('react-dom/test-utils')
  let captured = false
  handle.setPointerCapture = () => { captured = true }
  handle.hasPointerCapture = () => captured
  handle.releasePointerCapture = () => { captured = false }
  target.closest('[data-sort-index]').getBoundingClientRect = () => ({ top: 0, height: 40 })
  const previous = document.elementFromPoint
  document.elementFromPoint = () => target
  try {
    await act(() => Simulate.pointerDown(handle, { button: 0, pointerId: 1 }))
    assert.ok(document.querySelector('[data-dragging="true"]'), 'source collapses to its origin marker')
    assert.match(document.querySelector('.dta-drop-placeholder').textContent, /Drop here:/)
    await act(() => Simulate.pointerMove(handle, { pointerId: 1, clientX: 0, clientY: 0 }))
    assert.equal(target.closest('[data-sort-index]').previousElementSibling.className, 'dta-drop-placeholder', 'drop placeholder precedes the hovered row')
    await act(() => Simulate.pointerUp(handle, { pointerId: 1, clientX: 0, clientY: 0 }))
    assert.equal(document.querySelector('.dta-drop-placeholder'), null, 'placeholder clears after drop')
  } finally { document.elementFromPoint = previous }
}

test('resource configuration resolves positions in the background and keeps empty categories', async () => {
  const ui = dom(), previews = [], saved = []
  const layoutPreset = { ...preset, layout: { version: 1, source: 'preset-slots', identity: 'preserve', fallback: 'source-order', priority: 'preset', overrides: [] }, rules: [{ id: 'worldbook', kind: 'worldbook', enabled: true, role: 'preserve', lifetime: 'request' }] }
  const sources = [{ id: 'worldbook', pluginId: 'pmp-dsh-tavern', name: 'World books', roles: ['preserve'], lifetimes: ['request'], supportsModule: true, moduleAvailable: false, positions: [{ id: 'before', name: ['前置', 'Before'], macros: ['worldInfoBefore'] }, { id: 'after', name: ['后置', 'After'], macros: ['worldInfoAfter'] }] }]
  try {
    const fetcher = async (url, options) => {
      if (url.endsWith('/preview')) { previews.push(JSON.parse(options.body)); return json({ preview: { diagnostics: [], nodes: [], messages: [], resourceLayout: { positionDecisions: [{ sourceId: 'worldbook', positionId: 'before', decision: 'disabled' }] } } }) }
      if (options.method === 'PUT') { saved.push(JSON.parse(options.body)); return json({ preset: { ...JSON.parse(options.body), id: 'p' } }) }
      return json({ ...library, presets: [layoutPreset], sources })
    }
    await act(async () => ui.root.render(h(AssemblyPanel, { standalone: true, locale: 'en', sessionId: 's', fetcher })))
    assert.ok(previews.length >= 1)
    assert.match(ui.document.body.textContent, /worldInfoBefore/)
    assert.match(ui.document.body.textContent, /worldInfoAfter/)
    assert.match(ui.document.body.textContent, /No content is currently available/)
    const toggle = ui.document.querySelector('[aria-label="Enable position: Before"]')
    await act(async () => { toggle.checked = false; toggle.click() })
    await dragRow(ui.document, ui.document.querySelector('[aria-label="Move position: After"]'), ui.document.querySelector('[data-position-key="worldbook#before"]'))
    assert.equal([...ui.document.querySelectorAll('button')].some(b => ['Up', 'Down', '↑', '↓'].includes(b.textContent)), false)
    assert.match(ui.document.querySelector('.dta-position-stability').textContent, /Constant entries/)
    assert.ok(previews.length >= 1)
    await act(async () => button(ui.document, 'Assembly result').click())
    assert.ok(previews.length >= 1)
    assert.deepEqual(previews.at(-1).preset.layout.priority, ['preset', 'resource', 'default'])
    assert.equal(previews.at(-1).preset.layout.positions.find(p => p.positionId === 'before').enabled, false)
    assert.match(ui.document.body.textContent, /Disabled; excluded/)
    assert.equal(ui.document.querySelectorAll('[data-position-key]').length, 0)
    await act(async () => button(ui.document, 'Save rules').click())
    assert.equal(saved[0].layout.positions.length, 2)
  } finally { await ui.close() }
})

test('failed result loading preserves position draft for retry', async () => {
  const ui = dom(), requests = []
  try {
    const fetcher = async (url, options) => {
      if (!url.endsWith('/preview')) return json(library)
      requests.push(JSON.parse(options.body))
      if (requests.length === 1) return new Response(JSON.stringify({ error: 'Preview offline' }), { status: 503 })
      return json({ preview: { nodes: [], messages: [], diagnostics: [] } })
    }
    await act(async () => ui.root.render(h(AssemblyPanel, { standalone: true, locale: 'en', fetcher })))
    await dragRow(ui.document, ui.document.querySelector('[aria-label="Drag priority: Resource position and depth"]'), ui.document.querySelector('[data-priority="preset"]'))
    await act(async () => button(ui.document, 'Assembly result').click())
    assert.match(ui.document.querySelector('[role="alert"]').textContent, /Preview offline/)
    await act(async () => button(ui.document, 'Assembly result').click())
    assert.deepEqual(requests[1].preset.layout.priority, ['resource', 'preset', 'default'])
  } finally { await ui.close() }
})

for (const backend of ['native', 'core']) test(`result cards explain native history without expansion: ${backend}`, async () => {
  const ui = dom()
  const nodes = [
    { id: 'system', role: 'system', lifetime: 'request' },
    { id: 'context', role: 'user', lifetime: 'request', nativeDelivery: 'context' },
    { id: 'step', role: 'user', lifetime: 'request', nativeDelivery: 'pre-step' },
    ...(backend === 'core' ? [{ id: 'retained', role: 'user', lifetime: 'snapshot' }] : []),
  ].map(n => ({ ...n, name: n.id, source: { plugin: 'thirdparty', module: 'example' }, text: n.id, stability: 'conversation' }))
  try {
    const fetcher = async url => url.endsWith('/preview') ? json({ preview: { backend, nodes, messages: [], diagnostics: [] } }) : json(library)
    await act(() => ui.root.render(h(AssemblyPanel, { standalone: true, locale: 'en', sessionId: 's', fetcher })))
    await act(() => button(ui.document, 'Assembly result').click())
    const notes = [...ui.document.querySelectorAll('.dta-history-note')].map(n => n.textContent)
    assert.equal(notes.length, nodes.length)
    for (const note of ui.document.querySelectorAll('.dta-history-note')) {
      assert.equal(note.tagName, 'DD')
      assert.equal(note.previousElementSibling.textContent, 'Native history')
      assert.equal(note.closest('dl').querySelectorAll('dt').length, 4)
    }
    if (backend === 'native') {
      assert.match(notes[0], /Yes · System instruction updates/)
      assert.match(notes[1], /Yes · Save changed context/)
      assert.match(notes[2], /Yes · Injection saved each step/)
    } else {
      assert.ok(notes.every(n => n.startsWith('No ·')))
      assert.match(notes[3], /retained separately/)
    }
  } finally { await ui.close() }
})

test('cancelling a shared list drag clears origin and placeholder without editing the draft', async () => {
  const { Simulate } = await import('react-dom/test-utils')
  const ui = dom(), saved = []
  try {
    const fetcher = async (url, options) => {
      if (options.method === 'PUT') { saved.push(JSON.parse(options.body)); return json({ preset: saved.at(-1) }) }
      return json(library)
    }
    await act(() => ui.root.render(h(AssemblyPanel, { standalone: true, locale: 'en', sessionId: 's', fetcher })))
    const handle = ui.document.querySelector('[aria-label="Drag priority: Preset slots and macro references"]')
    handle.setPointerCapture = () => {}
    await act(() => Simulate.pointerDown(handle, { button: 0, pointerId: 1 }))
    assert.match(ui.document.querySelector('.dta-drop-placeholder').textContent, /Preset slots/)
    await act(() => Simulate.pointerCancel(handle))
    assert.equal(ui.document.querySelector('.dta-drop-placeholder'), null)
    assert.equal(ui.document.querySelector('[data-dragging="true"]'), null)
    await act(() => button(ui.document, 'Save rules').click())
    assert.equal(saved[0].layout, undefined)
  } finally { await ui.close() }
})


for (const openingDraft of [false,true]) test(`failed validation survives edits/save and blocks apply until rechecked (draft=${openingDraft})`,async()=>{
 const ui=dom(),calls=[];let rejected=true
 const current={...preset,rules:[{id:'native',kind:'native-system',enabled:true,role:'preserve',lifetime:'request'}]}
 const preview=async()=>{calls.push('preview');if(rejected)throw Error('SOURCE ROLE CONFLICT');return {preview:{nodes:[],messages:[],diagnostics:[]}}}
 const target={id:'draft',editable:true,getSelection:async()=>current,previewAssembly:preview,applyAssembly:async()=>{calls.push('apply');return {selection:current}}}
 const fetcher=async(url,options)=>{
  if(url.endsWith('/preview')){try{return json(await preview())}catch(error){return new Response(JSON.stringify({error:error.message}),{status:409})}}
  if(url.endsWith('/selection')){calls.push('apply');return json({selection:current})}
  if(options.method==='PUT'){calls.push('save');return json({preset:{...JSON.parse(options.body),id:'p'}})}
  return json({...library,presets:[current],sources:[{id:'native-system',name:'Native instructions',pluginId:'DSH',roles:['preserve'],lifetimes:['request']}]})
 }
 try{
  await act(()=>ui.root.render(h(AssemblyPanel,{standalone:true,locale:'en',fetcher,...openingDraft?{selectionTarget:target}:{sessionId:'s'}})))
  await act(()=>button(ui.document,'Assembly result').click())
  assert.match(ui.document.querySelector('[data-assembly-validation-error]').textContent,/SOURCE ROLE CONFLICT/)
  const toggle=ui.document.querySelector('[aria-label="Enable position: Native instructions"]')
  await act(()=>toggle.click())
  await act(()=>button(ui.document,'Save rules').click())
  assert.match(ui.document.querySelector('[data-assembly-validation-error]').textContent,/revalidation is required/)
  await act(()=>button(ui.document,'Save and apply to this session').click())
  assert.equal(calls.filter(x=>x==='apply').length,0)
  assert(calls.filter(x=>x==='preview').length >= 2)
  rejected=false
  await act(()=>button(ui.document,'Save and apply to this session').click())
  assert.equal(calls.filter(x => x === 'apply').length, 1)
  assert.equal(calls[calls.indexOf('apply') - 1], 'preview')
  assert.equal(ui.document.querySelector('[data-assembly-validation-error]'),null)
 }finally{await ui.close()}
})

test('automatic priority changes refresh definite editor positions without changing manual policy', async () => {
  const ui = dom()
  const current = { ...preset, layout: { version: 1, source: 'preset-slots', identity: 'position', fallback: 'source-order', priority: ['preset', 'resource', 'default'], overrides: [] }, rules: [{ id: 'worldbook', kind: 'worldbook', enabled: true, role: 'preserve', lifetime: 'request' }] }
  const sources = [{ id: 'worldbook', pluginId: 'pmp-dsh-tavern', name: 'World books', roles: ['preserve'], lifetimes: ['request'], positions: [{ id: 'before', name: ['前置', 'Before'] }, { id: 'after', name: ['后置', 'After'] }] }]
  try {
    const fetcher = async (url, options) => {
      if (!url.endsWith('/preview')) return json({ ...library, presets: [current], sources })
      const p = JSON.parse(options.body).preset
      const order = p.layout.priority[0] === 'resource' ? ['after', 'before'] : ['before', 'after']
      return json({ preview: { nodes: order.map(positionId => ({ id: positionId, source: { module: 'worldbook' }, positionId })), messages: [], diagnostics: [] } })
    }
    await act(async () => ui.root.render(h(AssemblyPanel, { standalone: true, locale: 'en', sessionId: 's', fetcher })))
    const keys = () => [...ui.document.querySelectorAll('[data-position-key]')].map(n => n.dataset.positionKey)
    assert.deepEqual(keys(), ['worldbook#before', 'worldbook#after'])
    assert.equal(ui.document.querySelectorAll('[data-priority]').length, 3)
    assert.equal(ui.document.querySelector('[data-priority="user"]'), null)
    await dragRow(ui.document, ui.document.querySelector('[aria-label="Drag priority: Resource position and depth"]'), ui.document.querySelector('[data-priority="preset"]'))
    assert.deepEqual(keys(), ['worldbook#after', 'worldbook#before'])
    assert.match(ui.document.body.textContent, /Definite positions follow current resources/)
  } finally { await ui.close() }
})

for (const locale of ['zh-CN', 'en']) test(`priority errors explain recovery and clear when switching strategies: ${locale}`, async () => {
  const { Simulate } = await import('react-dom/test-utils')
  const ui = dom()
  const good = { ...preset, id: 'good', name: 'Working strategy' }
  try {
    const fetcher = async (url, options) => {
      if (url.endsWith('/preview')) return new Response(JSON.stringify({ error: 'Invalid position priority order' }), { status: 400 })
      return json({ ...library, presets: [preset, good] })
    }
    await act(async () => ui.root.render(h(AssemblyPanel, { standalone: true, sessionId: 's', locale, close() {}, fetcher })))
    await act(async () => button(ui.document, locale === 'en' ? 'Assembly result' : '装配结果').click())
    const error = ui.document.querySelector('[data-error=true]')
    assert.ok(error)
    assert.match(error.textContent, locale === 'en' ? /Refresh the page/ : /刷新页面/)
    assert.match(error.textContent, /Tavern.*Assembler/)
    assert.match(error.textContent, locale === 'en' ? /save a copy/ : /另存为副本/)
    assert.equal(error.querySelector('details pre').textContent, 'Invalid position priority order')
    await act(async () => Simulate.change(ui.document.querySelector('.dta-grid select'), { target: { value: 'good' } }))
    assert.equal(ui.document.querySelector('[data-error=true]'), null)
  } finally { await ui.close() }
})

test('all built-in strategies render, preview and pass application preflight with current priorities', async () => {
  const { Simulate } = await import('react-dom/test-utils')
  const { AssemblyPresetStore } = await import('../adapters/tavern-runtime.js')
  const { createDefaultRegistry } = await import('../adapters/tavern.js')
  const { assembleRequest } = await import('../src/assemble.js')
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const directory = mkdtempSync(`${tmpdir()}/builtins-client-`), store = new AssemblyPresetStore(directory)
  const { BUILTINS: nativeBuiltins } = await import('../src/model.js')
  const presets = [...nativeBuiltins, ...store.list()], registry = createDefaultRegistry(), ui = dom(), applied = []
  try {
    assert.equal(presets.length, 4)
    const fetcher = async (url, options) => {
      const body = options.body && JSON.parse(options.body)
      if (url.endsWith('/preview')) return json({ preview: assembleRequest({ registry, preset: body.preset, nativeMessages: [{ id: 'old', role: 'user', content: [{ type: 'text', text: 'OLD' }] }, { id: 'now', role: 'user', content: [{ type: 'text', text: 'NOW' }] }], inputIds: ['now'], assets: { preset: { prompts: [{ identifier: 'main', content: 'HEAD', role: 'system', enabled: true }, { identifier: 'chatHistory', marker: true, enabled: true }, { identifier: 'jailbreak', content: 'TAIL', role: 'user', enabled: true }] } } }) })
      if (url.endsWith('/selection')) { applied.push(body.id); return json({ selection: presets.find(p => p.id === body.id) }) }
      return json({ ...library, presets, defaultPresetId: presets[0].id, sources: registry.list(), capabilities: { native: true, core: true } })
    }
    await act(async () => ui.root.render(h(AssemblyPanel, { standalone: true, sessionId: 's', locale: 'en', close() {}, fetcher })))
    for (const candidate of presets) {
      await act(async () => Simulate.change(ui.document.querySelector('.dta-grid select'), { target: { value: candidate.id } }))
      await act(async () => button(ui.document, 'Assembly result').click())
      assert.equal(ui.document.querySelector('[data-error=true]'), null, candidate.id)
      assert.ok(ui.document.querySelectorAll('.dta-row').length, candidate.id)
      await act(async () => button(ui.document, 'Save and apply to this session').click())
      assert.equal(applied.at(-1), candidate.id)
    }
  } finally { await ui.close(); rmSync(directory, { recursive: true, force: true }) }
})

test('settings navigation hands off to the guarded editor and closes the native settings panel', async () => {
  const ui = dom(), controller = createAssemblyController({ list: source(catalog(row('settings-session'))) }); let closes = 0
  try {
    await act(async () => ui.root.render(h(AssemblySettingsEntry, { assembler: controller, close: () => { closes++ } })))
    assert.equal(controller.getSnapshot().open, true)
    assert.equal(controller.getSnapshot().session.id, 'settings-session')
    assert.equal(closes, 1)
  } finally { await ui.close(); controller.dispose() }
})


test('standard host explains disabled core apply below the actions and clears the reason on switching back', async () => {
  const { NATIVE_BUILTINS } = await import('../adapters/tavern.js')
  const { Simulate } = await import('react-dom/test-utils')
  const ui = dom(), draft = { ...NATIVE_BUILTINS[0], builtin: false }
  try {
    const fetcher = async url => url.endsWith('/preview')
      ? json({ preview: { nodes: [], messages: [], diagnostics: [] } })
      : json({ ...library, presets: [draft], defaultPresetId: draft.id, capabilities: { native: true, core: false } })
    await act(async () => ui.root.render(h(AssemblyPanel, { sessionId: 'test', standalone: true, locale: 'zh-CN', fetcher })))
    const apply = button(ui.document, '保存并应用到当前会话')
    assert.equal(apply.disabled, false)
    const backend = ui.document.querySelector('select[aria-label="接入方式"]')
    await act(async () => Simulate.change(backend, { target: { value: 'core' } }))
    assert.equal(apply.disabled, true)
    const reason = ui.document.getElementById(apply.getAttribute('aria-describedby'))
    assert.equal(apply.parentElement.nextElementSibling, reason)
    assert.equal(reason.getAttribute('data-error'), 'true')
    assert.equal(reason.getAttribute('role'), 'alert')
    assert.match(reason.textContent, /未启用进阶版核心扩展/)
    assert.match(reason.textContent, /标准版 · 官方接口/)
    assert.match(reason.textContent, /重启后端/)
    await act(async () => Simulate.change(backend, { target: { value: 'native' } }))
    assert.equal(apply.disabled, false)
    assert.equal(ui.document.getElementById('dta-apply-blocked'), null)
  } finally { await ui.close() }
})
