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
      if (options.method === 'PUT') {
        if (saveResponse) return saveResponse
        stored = JSON.parse(options.body).policy; revision++
      }
      return json({ ok: true, policy: structuredClone(stored), revision, capabilities: { mode: selection?.backend === 'core' ? 'advanced' : 'standard' } })
    }
    if (url.endsWith('/selection')) {
      selection = JSON.parse(options.body).id ? { id: preset.id, name: preset.name, backend: preset.backend } : null
      return json({ selection })
    }
    if (options.method === 'PUT' || options.method === 'POST') {
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

test('history editor is a collapsed session section using the injected transport, API root and MVU presets', async () => {
  const ui = harness()
  try {
    await ui.render({ historyApiRoot: '/authenticated/history-policy' })
    const section = ui.document.querySelector('.dta-history-section')
    assert.ok(section && !section.hasAttribute('open'))
    assert.equal(section.querySelector('summary').textContent, '模型历史筛选')
    assert.deepEqual([...ui.document.querySelector('.dta-tabs').children].map(node => node.textContent), ['资源位置', '装配结果'])
    assert.ok(findButton(ui.document, '保存规则'))
    assert.ok(findButton(ui.document, '保存历史规则'))
    assert.ok(ui.calls.some(call => call.url === '/authenticated/history-policy?sessionId=a'))
    await ui.click('添加 MVU')
    assert.deepEqual(JSON.parse(ui.document.querySelector('textarea[aria-label="片段规则 JSON"]').value), [fragmentPresets[0].rule])
    assert.equal(ui.unload(), true)
    await ui.render({ sessionId: undefined })
    assert.equal(ui.document.querySelector('.dta-history-section'), null)
    assert.ok(ui.calls.find(call => call.url.includes('/authenticated/history-policy')).options.signal.aborted)
  } finally { await ui.close() }
})

test('history remount follows applied backend, preserving drafts across equivalent props and strategy edits', async () => {
  const ui = harness()
  try {
    await ui.render()
    await ui.editHistory()
    const original = ui.document.querySelector('.history-policy-panel')
    await ui.render({ historyFragmentPresets: structuredClone(fragmentPresets) })
    await ui.selectBackend('native')
    assert.equal(ui.document.querySelector('.history-policy-panel'), original)
    assert.equal(ui.calls.filter(call => call.url.includes('/history-policy')).length, 1)
    await ui.click('应用到当前会话')
    assert.ok(ui.document.querySelector('[role="alertdialog"]'))
    await ui.click('取消')
    assert.equal(ui.calls.filter(call => call.url.endsWith('/selection')).length, 0)
    assert.equal(ui.document.querySelector('.history-policy-panel'), original)
    await ui.click('应用到当前会话')
    await ui.click('确认')
    assert.notEqual(ui.document.querySelector('.history-policy-panel'), original)
    assert.equal(ui.calls.filter(call => call.url.includes('/history-policy')).length, 2)
    assert.ok(ui.calls.find(call => call.url.includes('/history-policy')).options.signal.aborted)
    assert.match(ui.document.querySelector('.history-policy-panel h2').textContent, /标准版/)
  } finally { await ui.close() }
})

test('history dirty state participates in navigation, close and beforeunload; only a successful history save clears it', async () => {
  const ui = harness()
  try {
    await ui.render({ registerBeforeLeave: ui.register })
    await ui.editHistory()
    assert.equal(ui.unload(), true)
    let decision
    await act(async () => { decision = ui.guard() })
    await ui.click('取消')
    assert.equal(await decision, false)
    await ui.click('保存规则')
    assert.equal(ui.unload(), true)
    ui.failSave(json({ ok: false, error: '版本冲突' }, 409))
    await ui.click('保存历史规则')
    assert.equal(ui.unload(), true)
    assert.match(ui.document.querySelector('.history-policy-panel [role=status]').textContent, /版本冲突/)
    ui.failSave(null)
    await ui.click('保存历史规则')
    assert.equal(ui.unload(), false)
    assert.equal(await ui.guard(), true)
    await ui.render({ registerBeforeLeave: undefined })
    await ui.editHistory()
    await act(async () => ui.document.querySelector('button[aria-label="关闭"]').click())
    assert.equal(ui.closed, false)
    await ui.click('取消')
    assert.equal(ui.closed, false)
  } finally { await ui.close() }
})

test('session disposal aborts old history transport and ignores its late save completion', async () => {
  const ui = harness(), pending = deferred()
  try {
    await ui.render()
    await ui.editHistory()
    ui.failSave(pending.promise)
    await ui.click('保存历史规则')
    const oldSave = ui.calls.find(call => call.url.includes('/history-policy') && call.options.method === 'PUT')
    await ui.render({ sessionId: 'b' })
    assert.equal(oldSave.options.signal.aborted, true)
    await ui.editHistory()
    await act(async () => pending.resolve(json({ ok: true, revision: 1, policy: policy() })))
    assert.equal(ui.unload(), true)
    assert.ok(ui.calls.some(call => call.url.endsWith('/history-policy?sessionId=b')))
  } finally { await ui.close() }
})

test('editing history while its save is pending retains the new unsaved changes', async () => {
  const ui = harness(), pending = deferred()
  try {
    await ui.render()
    await ui.editHistory()
    ui.failSave(pending.promise)
    await ui.click('保存历史规则')
    await ui.editHistory()
    await act(async () => pending.resolve(json({ ok: true, revision: 1, policy: { ...policy(), enabled: true } })))
    assert.equal(ui.unload(), true)
  } finally { await ui.close() }
})
