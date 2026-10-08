import { createElement as h, useEffect, useRef } from 'react'
import { mountHistoryPolicyPanel } from './history-client.js'

const EMPTY_PRESETS = []

/** Keep the imperative editor bound to the applied session/backend, not the strategy draft. */
export function HistoryPanel({ sessionId, backend, fetcher, root, fragmentPresets = EMPTY_PRESETS, onDirtyChange, locale = 0 }) {
  const container = useRef(null)
  const callbacks = useRef({ onDirtyChange })
  callbacks.current = { onDirtyChange }
  // Parent renders can provide fresh equivalent arrays without discarding an open editor.
  const presets = JSON.stringify(fragmentPresets)
  useEffect(() => {
    let active = true
    callbacks.current.onDirtyChange?.(false)
    const editor = mountHistoryPolicyPanel(container.current, {
      sessionId, root, request: fetcher, fragmentPresets: JSON.parse(presets),
      onDirtyChange: dirty => { if (active) callbacks.current.onDirtyChange?.(dirty) },
    })
    return () => {
      active = false
      editor.dispose()
    }
  }, [sessionId, backend, fetcher, root, presets])
  return h('details', { className: 'dta-history-section' },
    h('summary', null, locale === 0 ? '模型历史筛选' : 'Model history filtering'),
    h('div', { ref: container, className: 'dta-history-editor' }))
}

export const historyPanelCss = `
.dta-history-section{margin-top:24px;border-top:1px solid var(--dta-border);padding-top:20px}
.dta-history-section>summary{cursor:pointer;font-size:15px;font-weight:600;padding:4px 0;overflow-wrap:anywhere}
.dta-history-editor{min-width:0}.history-policy-panel{display:grid;gap:16px;padding-top:16px;min-width:0}
.history-policy-panel h2,.history-policy-panel h3,.history-policy-panel h4,.history-policy-panel p{margin:0}
.history-policy-panel h2{font-size:17px}.history-policy-panel h3{font-size:15px}.history-policy-panel h4{font-size:14px}
.history-policy-panel fieldset{display:grid;gap:14px;min-width:0;margin:0;padding:16px;border:1px solid var(--dta-border);border-radius:10px}
.history-policy-panel legend{padding:0 6px;font-weight:600}.history-policy-panel label{display:inline-flex;align-items:center;gap:8px;margin:0 16px 8px 0}
.history-policy-panel input[type=checkbox]{width:18px;height:18px;margin:0;accent-color:#2484ed;flex-shrink:0}
.history-policy-panel fieldset>div:has(>button),.history-policy-panel>div:has(>button):not(:has(textarea)){display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.dtv-assembly-screen .history-policy-panel input:not([type=checkbox]){width:240px;max-width:100%}
.history-policy-panel>div:has(textarea){display:flex;flex-direction:column;align-items:stretch;gap:16px;min-width:0}
.history-policy-panel>div:has(textarea)>button{align-self:flex-start}.history-policy-panel textarea{width:100%;resize:vertical;min-height:160px;font-family:ui-monospace,monospace}
.history-policy-panel [role=status]{padding:12px 15px;border-radius:10px;background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base));overflow-wrap:anywhere}
.history-policy-panel details{margin:12px 0;padding:12px 14px;border:1px solid var(--dta-border);border-radius:10px}.history-policy-panel details>summary{cursor:pointer;overflow-wrap:anywhere}
.history-policy-panel details[open]>summary,.history-policy-panel details p,.history-policy-panel details h4{margin-bottom:12px}.history-policy-panel pre{margin:12px 0}
`
