import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHTML } from 'linkedom'
import { build } from 'esbuild'
import { AssemblyPanel } from '../src/client.js'
import { AssemblyOverlay, apply, createAssemblyController, createSessionWithPreset, inject, mainSession, name, sessionLabel } from '../src/plugin-client.js'

const json = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
const deferred = () => { let resolve; return { promise: new Promise(r => { resolve = r }), resolve: value => resolve(value) } }
function source(snapshot) {
  const listeners = new Set()
  return { getSnapshot: () => snapshot, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) }, set: value => { snapshot = value; for (const fn of listeners) fn() }, get listeners() { return listeners.size } }
}
const catalog = (...rows) => ({ byId: Object.fromEntries(rows.map(row => [row.id, row])), ids: rows.map(r => r.id), phase: 'ready' })
const row = (id, mainView = 1) => ({ id, title: `Session ${id}`, blank: false, retainedBy: { mainView } })

test('entry registers owned root footer and overlay without a session header shortcut or Tavern', () => {
  assert.equal(name, 'dsh-prompt-assembler')
  assert.deepEqual(inject, ['slots', 'sessions', 'workspaces', 'uiWorkspace'])
  const entries = [], cleanups = []
  const ctx = { sessions: { list: source(catalog()) }, workspaces: {}, uiWorkspace: {}, effect: fn => cleanups.push(fn()), slots: {
    inject: (slot, fn) => { fn() }, register: (entry, component) => { entries.push({ ...entry, component }); return () => {} },
  } }
  apply(ctx)
  assert.deepEqual(entries.map(e => e.name), ['sidebar.footer.action', 'shell.overlay'])
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
const preset = { id: 'p', name: 'Strategy', builtin: false, placement: 'modules', rules: [] }
const library = { presets: [preset], defaultPresetId: 'p', selection: null, capability: true, sources: [] }
const button = (document, label) => [...document.querySelectorAll('button')].find(node => node.textContent === label)

test('mounted panel saves a new dirty draft before creating, with no active session', async () => {
  const ui = dom(), calls = []
  try {
    const fetcher = async (url, options) => {
      if (options.method === 'POST') { calls.push(['save', JSON.parse(options.body)]); return json({ preset: { ...preset, id: 'saved' } }) }
      return json(library)
    }
    await act(async () => ui.root.render(h(AssemblyPanel, { standalone: true, locale: 'en', sessionLabel: 'New Session', close() {}, fetcher, onCreateSession: async id => calls.push(['create', id]) })))
    assert.match(ui.document.querySelector('[data-assembly-session]').textContent, /New Session/)
    assert.equal(button(ui.document, 'Apply to this session').disabled, true)
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
    await act(async () => (button(ui.document, 'Apply to this session') ?? button(ui.document, '应用到当前会话')).click())
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
