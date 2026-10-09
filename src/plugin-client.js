import { createElement as h, useEffect, useState, useSyncExternalStore } from 'react'
import { AssemblyPanel } from './client.js'
import { API_ROOT, assemblerFetch } from './client-fetch.js'

export const name = 'dsh-prompt-assembler'
export const inject = ['slots', 'sessions', 'workspaces', 'uiWorkspace']
export const REFRESH_EVENT = 'dsh-prompt-assembler:refresh'

export function mainSession(snapshot) {
  return Object.values(snapshot?.byId ?? {}).find(row => (row.retainedBy?.mainView ?? 0) > 0) ?? null
}
export function sessionLabel(session, locale = 'zh-CN') {
  return session?.blank || !session ? (locale === 'zh-CN' ? '新会话' : 'New Session') : session.title || session.displayTitle || session.id
}

// The opening binding remains authoritative while a leave prompt is pending
// or declined, even if the native main-view navigation has already changed.
export function createAssemblyController(sessions) {
  let state = { open: false, session: null, revision: 0 }, guard, disposed = false, transition = 0
  const listeners = new Set()
  const publish = patch => { if (disposed) return; state = { ...state, ...patch, revision: state.revision + 1 }; for (const fn of listeners) fn() }
  const getMain = () => mainSession(sessions.list.getSnapshot())
  const move = async (session, open) => {
    const ticket = ++transition
    if (state.open && (state.session?.id !== session?.id || !open) && guard && !await guard()) return false
    if (disposed || ticket !== transition) return false
    if (state.session?.id !== session?.id || state.open !== open) guard = undefined
    publish({ open, session })
    return true
  }
  let lastMainId = getMain()?.id
  const stop = sessions.list.subscribe(() => {
    const session = getMain()
    if (session?.id === lastMainId) {
      if (state.open && state.session?.id === session?.id) publish({ session })
      return
    }
    lastMainId = session?.id
    if (state.open) void move(session, true)
  })
  return {
    getSnapshot: () => state,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) },
    open: sessionId => move(sessionId ? sessions.list.getSnapshot().byId[sessionId] ?? { id: sessionId } : getMain(), true),
    close: () => move(state.session, false),
    registerBeforeLeave: fn => { guard = fn; return () => { if (guard === fn) guard = undefined } },
    // Completing an intentional create workflow closes the old editor without
    // consulting its busy leave guard. No late callback can reopen it.
    completeCreate: () => { ++transition; guard = undefined; publish({ open: false, session: null }) },
    dispose: () => { disposed = true; ++transition; stop(); listeners.clear(); guard = undefined },
    isDisposed: () => disposed,
  }
}

export async function createSessionWithPreset({ sessions, uiWorkspace, fetcher = assemblerFetch, workspaceId, presetId, isCurrent = () => true }) {
  if (!workspaceId) throw new Error('请选择工作区 / Choose a workspace')
  if (!presetId) throw new Error('Missing assembly preset')
  if (!isCurrent()) throw new DOMException('Editor closed', 'AbortError')
  const sessionId = await sessions.create({ workspaceId })
  if (!isCurrent()) throw new DOMException('Editor closed', 'AbortError')
  const response = await fetcher(`${API_ROOT}/assembly-presets/selection`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, id: presetId }),
  })
  const data = await response.json()
  if (!response.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${response.status}`)
  if (!isCurrent()) throw new DOMException('Editor closed', 'AbortError')
  await uiWorkspace.openSession(sessionId)
  return sessionId
}

export function AssemblyLauncher({ assembler, wide = true, sessionId }) {
  return h('button', { type: 'button', className: 'dta-launcher', style: { font: 'inherit', color: 'inherit', border: '1px solid currentColor', borderRadius: 8, background: 'transparent', padding: '7px 10px', cursor: 'pointer' }, title: '提示词装配 / Prompt assembly', 'aria-label': '提示词装配', onClick: () => void assembler.open(sessionId) }, wide ? '提示词装配' : '⌘')
}

// Settings owns navigation; hand off to the existing guarded strategy editor.
export function AssemblySettingsEntry({ assembler, close }) {
  useEffect(() => { void assembler.open().then(opened => { if (opened) close() }) }, [assembler, close])
  return null
}

export function AssemblyOverlay({ assembler, sessions, workspaces, uiWorkspace, fetcher = assemblerFetch }) {
  const state = useSyncExternalStore(assembler.subscribe, assembler.getSnapshot, assembler.getSnapshot)
  const workspaceState = useSyncExternalStore(workspaces.list.subscribe.bind(workspaces.list), workspaces.list.getSnapshot.bind(workspaces.list), workspaces.list.getSnapshot.bind(workspaces.list))
  const [locale, setLocale] = useState(globalThis.navigator?.language?.startsWith('zh') ? 'zh-CN' : 'en')
  const [chosenWorkspace, setWorkspace] = useState('')
  useEffect(() => { if (!state.open) setWorkspace('') }, [state.open])
  useEffect(() => {
    if (!state.open) return
    const handler = event => { if (event.key === 'Escape') { event.stopImmediatePropagation(); void assembler.close() } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state.open, assembler])
  if (!state.open) return null
  const items = workspaceState.phase === 'ready' ? workspaceState.items : []
  const workspaceId = items.length === 1 ? items[0].workspaceId : items.some(w => w.workspaceId === chosenWorkspace) ? chosenWorkspace : ''
  const controls = h('div', { className: 'dta-toolbar dta-session-controls' },
    h('label', null, locale === 'zh-CN' ? '新会话工作区' : 'New session workspace',
      h('select', { value: workspaceId, onChange: e => setWorkspace(e.target.value), disabled: items.length === 0, 'aria-label': locale === 'zh-CN' ? '新会话工作区' : 'New session workspace' },
        h('option', { value: '' }, locale === 'zh-CN' ? '请选择工作区…' : 'Choose a workspace…'),
        ...items.map(w => h('option', { key: w.workspaceId, value: w.workspaceId }, w.title)))))
  const interfaceControls = h('div', { className: 'dta-toolbar dta-session-controls' }, h('label', null, 'Language / 语言', h('select', { value: locale, onChange: e => setLocale(e.target.value), 'aria-label': 'Language / 语言' }, h('option', { value: 'zh-CN' }, '中文'), h('option', { value: 'en' }, 'English'))))
  return h(AssemblyPanel, {
    sessionId: state.session?.id, sessionLabel: sessionLabel(state.session, locale), locale, standalone: true,
    close: assembler.close, registerBeforeLeave: assembler.registerBeforeLeave, fetcher,
    refreshEvent: REFRESH_EVENT, createSessionControls: controls, interfaceControls,
    onCreateSession: async presetId => {
      const original = assembler.getSnapshot()
      const id = await createSessionWithPreset({ sessions, uiWorkspace, fetcher, workspaceId, presetId,
        isCurrent: () => !assembler.isDisposed() && assembler.getSnapshot().open && assembler.getSnapshot().session?.id === original.session?.id })
      assembler.completeCreate()
      globalThis.window?.dispatchEvent(new Event(REFRESH_EVENT))
      return id
    },
  })
}

export function apply(ctx) {
  const assembler = createAssemblyController(ctx.sessions)
  ctx.effect(() => () => assembler.dispose())
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: `${name}-settings`, order: 80,
    label: () => globalThis.navigator?.language?.startsWith('zh') ? '提示词装配' : 'Prompt assembly',
    inject: () => ({ assembler }),
  }, AssemblySettingsEntry))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: `${name}-editor`, order: 80,
    inject: () => ({ assembler, sessions: ctx.sessions, workspaces: ctx.workspaces, uiWorkspace: ctx.uiWorkspace, fetcher: assemblerFetch }),
  }, AssemblyOverlay))
}
