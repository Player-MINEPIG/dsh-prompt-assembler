import test from 'node:test'
import assert from 'node:assert/strict'
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHTML } from 'linkedom'
import { AssemblyPanel } from '../src/client.js'

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const policy = () => ({ version: 1, enabled: false, sources: [{ kind: 'tavern', include: true }], contentTypes: { text: true, image: true, reasoning: true }, fragments: [] })
const fragmentPresets = [{ name: 'MVU', rule: { id: 'mvu', sourceKind: 'model', enabled: false, start: '<mvu>', end: '</mvu>', mode: 'lines' } }]
const findButton = (document, label) => [...document.querySelectorAll('button')].find(button => button.textContent === label)
const deferred = () => { let resolve; return { promise: new Promise(r => { resolve = r }), resolve: value => resolve(value) } }

function harness() {
  const { window } = parseHTML('<html><body><main></main></body></html>')
  const previous = Object.fromEntries(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, globalThis[key]]))
  Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(window.document.querySelector('main')), calls = []
  let preset = { id: 'p', name: '策略', builtin: false, backend: 'core', placement: 'modules', rules: [] }
  let selection = { id: 'p', name: '策略', backend: 'core' }, revision = 0, stored = policy(), saveResponse, guard, closed = false
  const fetcher = async (url, options = {}) => {
    calls.push({ url, options })
    if (url.includes('/history-policy')) {
      if (url.includes('/preview')) return json({ok:true,preview:[],audit:{decisions:[],warnings:[]},operations:[]})
      if (options.method === 'PUT') {
        if (saveResponse) return saveResponse
        stored = JSON.parse(options.body).policy; revision++
      }
      return json({ ok: true, policy: structuredClone(stored), revision, capabilities: { mode: selection?.backend === 'core' ? 'advanced' : 'standard' } })
    }
    if (url.includes('/history-policy/preview')) return json({ok:true,preview:[],audit:{decisions:[],warnings:[]},operations:[]})
    if (url.endsWith('/preview')) return json({preview:{nodes:[],messages:[],diagnostics:[]}})
    if (url.endsWith('/selection')) {
      selection = JSON.parse(options.body).id ? structuredClone(preset) : null
      return json({ selection })
    }
    if (options.method === 'PUT' || options.method === 'POST') {
      if (saveResponse) return saveResponse
      preset = JSON.parse(options.body); return json({ preset })
    }
    return json({ presets: [preset], defaultPresetId: 'p', selection, capability: true, sources: [] })
  }
  const props = { standalone: true, sessionId: 'a', fetcher, locale: 'zh-CN', historyFragmentPresets: fragmentPresets, close: () => { closed = true } }
  return {
    document: window.document, calls, props,
    get closed() { return closed }, get guard() { return guard },
    register: callback => { guard = callback; return () => { guard = null } },
    failSave(value) { saveResponse = value },
    render: async extra => { await act(async () => root.render(h(AssemblyPanel, { ...props, ...extra }))) },
    click: async label => { await act(async () => findButton(window.document, label).click()) },
    editHistory: async () => { await act(async () => { const input = window.document.querySelector('[aria-label="启用历史筛选"]'); input.checked = !input.checked; input.dispatchEvent(new window.Event('change', { bubbles: true })) }) },
    selectBackend: async backend => { await act(async () => { const select = window.document.querySelector('[aria-label="接入方式"]'); [...select.options].find(option => option.value === backend).selected = true; select.dispatchEvent(new window.Event('change', { bubbles: true })) }) },
    unload: () => { const event = new window.Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented },
    async close() { await act(async () => root.unmount()); for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value } },
  }
}

test('history is a collapsible strategy section between assembly and application, with shared save/apply', async () => {
  const ui = harness()
  try {
    await ui.render({ historyApiRoot: '/authenticated/history-policy' })
    const section = ui.document.querySelector('.dta-history-section')
    assert.ok(section?.hasAttribute('open'))
    assert.equal(section.querySelector('summary').textContent, '历史筛选规则与预览')
    assert.ok(ui.document.querySelector('.dta-assembly-section>summary'))
    assert.equal(section.previousElementSibling.className, 'dta-editor-section dta-assembly-section')
    assert.equal(section.nextElementSibling.textContent, '会话应用')
    assert.equal(findButton(ui.document, '保存历史规则'), undefined)
    assert.ok(ui.calls.some(call => call.url === '/authenticated/history-policy?sessionId=a'))
    await ui.click('添加 MVU')
    assert.deepEqual(JSON.parse(ui.document.querySelector('textarea[aria-label="片段规则 JSON"]').value), [fragmentPresets[0].rule])
    assert.equal(ui.unload(), true)
    await ui.click('保存规则')
    const save = ui.calls.find(call => call.options.method === 'PUT')
    assert.deepEqual(JSON.parse(save.options.body).historyPolicy.fragments, [fragmentPresets[0].rule])
    assert.equal(ui.calls.some(call => call.url.endsWith('/selection')), false)
    assert.equal(ui.unload(), false)
    await ui.click('应用到当前会话')
    assert.ok(ui.calls.some(call => call.url.endsWith('/selection')))
    assert.equal(ui.calls.some(call => call.url.includes('/history-policy') && call.options.method === 'PUT'), false)
  } finally { await ui.close() }
})

test('backend edits update history capabilities immediately and retain history draft', async () => {
  const ui = harness()
  try {
    await ui.render(); await ui.editHistory(); await ui.click('添加 MVU')
    const original = ui.document.querySelector('.history-policy-panel')
    await ui.render({ historyFragmentPresets: structuredClone(fragmentPresets) })
    assert.equal(ui.document.querySelector('.history-policy-panel'), original)
    await ui.selectBackend('native')
    assert.equal(ui.document.querySelector('[aria-label="启用历史筛选"]').checked, true)
    assert.equal(ui.document.querySelector('[aria-label="片段规则 JSON"]').disabled, true)
    assert.deepEqual(JSON.parse(ui.document.querySelector('textarea').value), [fragmentPresets[0].rule])
    await ui.click('匹配预览')
    const preview = ui.calls.find(call => call.url.includes('/history-policy/preview'))
    assert.equal(JSON.parse(preview.options.body).backend, 'native')
    assert.equal(ui.calls.some(call => call.url.endsWith('/selection')), false)
    await ui.selectBackend('core')
    assert.equal(ui.document.querySelector('[aria-label="片段规则 JSON"]').disabled, false)
    assert.equal(ui.document.querySelector('[aria-label="启用历史筛选"]').checked, true)
  } finally { await ui.close() }
})

test('unsaved history shares navigation guard and failed preset saves preserve edits', async () => {
  const ui = harness()
  try {
    await ui.render({ registerBeforeLeave: ui.register }); await ui.editHistory()
    assert.equal(ui.unload(), true)
    let decision
    await act(async () => { decision = ui.guard() }); await ui.click('取消')
    assert.equal(await decision, false)
    ui.failSave(json({ ok: false, error: '保存失败' }, 409)); await ui.click('保存规则')
    assert.equal(ui.unload(), true)
    ui.failSave(null); await ui.click('保存规则')
    assert.equal(ui.unload(), false)
    assert.equal(await ui.guard(), true)
  } finally { await ui.close() }
})

test('new sessions can edit policies, and invalid fragment JSON cannot be saved or applied', async () => {
  const ui = harness()
  try {
    await ui.render({ sessionId: undefined })
    assert.ok(ui.document.querySelector('.dta-history-section'))
    assert.equal(findButton(ui.document, '匹配预览').disabled, true)
    await act(async () => { const input = ui.document.querySelector('textarea'); input.value = '{'; input.dispatchEvent(new window.Event('input', {bubbles:true})) })
    assert.equal(ui.unload(), true)
    await ui.click('保存规则')
    assert.equal(ui.calls.some(call => call.options.method === 'PUT'), false)
    assert.ok(ui.document.querySelector('[role=alert]'))
  } finally { await ui.close() }
})

test('switching sessions aborts the prior legacy policy read', async () => {
  const ui = harness()
  try {
    await ui.render()
    const prior = ui.calls.find(call => call.url.includes('/history-policy'))
    await ui.render({sessionId:'b'})
    assert.equal(prior.options.signal.aborted, true)
    assert.ok(ui.calls.some(call => call.url.endsWith('/history-policy?sessionId=b')))
  } finally { await ui.close() }
})
