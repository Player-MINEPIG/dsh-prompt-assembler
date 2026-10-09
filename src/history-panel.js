import { createElement as h, useEffect, useRef } from 'react'
import { mountHistoryPolicyPanel } from './history-client.js'

const EMPTY_PRESETS = []

/** The editor contributes to the strategy draft; it never applies session changes itself. */
export function HistoryPanel({ sessionId, presetId, value, backend, fetcher, root, editorRef, fragmentPresets = EMPTY_PRESETS, onChange, onInvalid, onDirtyChange, locale = 0 }) {
  const container = useRef(null)
  const callbacks = useRef({ onChange, onInvalid, onDirtyChange })
  callbacks.current = { onChange, onInvalid, onDirtyChange }
  const presets = JSON.stringify(fragmentPresets)
  useEffect(() => {
    let active = true
    const editor = mountHistoryPolicyPanel(container.current, {
      sessionId, root, request: fetcher, value, backend, fragmentPresets: JSON.parse(presets),
      onChange: policy => { if (active) callbacks.current.onChange?.(policy) },
      onInvalid: error => { if (active) callbacks.current.onInvalid?.(error) },
      onDirtyChange: dirty => { if (active) callbacks.current.onDirtyChange?.(dirty) },
    })
    editorRef.current = editor
    return () => { active = false; if (editorRef.current === editor) editorRef.current = null; editor.dispose() }
    // Local keystrokes update the parent draft without recreating the editor.
  }, [sessionId, presetId, backend, fetcher, root, presets])
  return h('details', { className: 'dta-editor-section dta-history-section', open: true },
    h('summary', null, locale === 0 ? '历史筛选规则与预览' : 'History filtering rules and preview'),
    h('div', { ref: container, className: 'dta-history-editor' }))
}

export const historyPanelCss = `
.dta-editor-section{margin:24px 0;border:1px solid var(--dta-border);border-radius:12px;overflow:hidden;min-width:0}
.dta-editor-section>summary{padding:16px 20px;background:light-dark(#edf3ff,#182a44);color:light-dark(#2458a5,#9fc4ff);font-size:17px;font-weight:650;cursor:pointer}
.dta-editor-section>div{padding:20px;min-width:0}
.dta-history-section>div{padding-top:0}
.history-policy-panel[data-view=preview]>label,.history-policy-panel[data-view=preview]>fieldset,.history-policy-panel[data-view=preview]>.history-advanced{display:none}
.history-policy-panel[data-view=rules]>.history-results{display:none}
.history-diff-legend{display:flex;flex-wrap:wrap;gap:12px}.history-diff-legend>span{padding:6px 10px;border-radius:6px}
.history-policy-panel .history-diff{white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;line-height:1.8;background:transparent}
.history-diff-remove{background:light-dark(#ffe0e3,#542c34);color:light-dark(#8c2431,#ffc5cd)}
.history-diff-keep{background:light-dark(#e1edff,#223a58);color:light-dark(#214c83,#c5ddff)}
.history-diff-add{background:light-dark(#daf4e3,#234634);color:light-dark(#1b6139,#bde9cd)}
.history-diff span{box-decoration-break:clone;-webkit-box-decoration-break:clone}
.history-result-remove{border-left:4px solid #d8586b!important}.history-result-keep{border-left:4px solid #5687db!important}.history-result-add{border-left:4px solid #4a9a69!important}
.dta-history-section>summary{overflow-wrap:anywhere}
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
