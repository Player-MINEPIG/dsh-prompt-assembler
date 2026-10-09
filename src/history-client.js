import { DEFAULT_HISTORY_POLICY, normalizeHistoryPolicy } from './history/schema.js'

/** Framework-independent embeddable editor. Transport is injectable for authenticated desktop hosts. */
export function mountHistoryPolicyPanel(container, { sessionId, root = '/dsh-prompt-assembler/api/v1/history-policy', request = fetch, fragmentPresets = [], onDirtyChange = () => {}, onSaved = () => {}, value, backend, onChange, onInvalid = () => {}, onReady = () => {} }) {
  const doc = container.ownerDocument, abort = new AbortController()
  const embedded = typeof onChange === 'function'
  let loaded = false
  let revision = 0, policy, disposed = false, standard = false, dirty = false, editGeneration = 0
  const setDirty = value => { if (value) editGeneration++; dirty = value; onDirtyChange(value); if (value && embedded && loaded) { try { onChange(normalizeHistoryPolicy(draft())); onInvalid('') } catch (error) { onInvalid(error.message); status.textContent = `规则无效：${error.message}。请检查片段 JSON 或来源名称后再保存。` } } }
  const el = (tag, text, parent = container) => { const node = doc.createElement(tag); if (text) node.textContent = text; parent.append(node); return node }
  const panel = el('section'); panel.className = 'history-policy-panel'; panel.dataset.view = 'rules'
  const tabs = embedded ? el('div', '', panel) : null
  if (tabs) tabs.className = 'dta-tabs'
  panel.addEventListener('input', () => setDirty(true))
  panel.addEventListener('change', () => setDirty(true))
  const title = el('h2', '模型历史筛选', panel); title.hidden = embedded
  const explanation = el('p', '保留原始日志和展示原文。保存后从下一步请求重新筛选现存有效历史，同一步重试沿用原规则；关闭后恢复原生有效历史。已被原生压缩的内容不会复原。', panel)
  const label = el('label', '', panel), enabled = el('input', '', label); enabled.type = 'checkbox'; enabled.setAttribute('aria-label', '启用历史筛选'); el('span', ' 启用历史筛选', label)
  const sources = el('fieldset', '', panel); el('legend', '保留哪些历史来源', sources)
  const sourceRows = el('div', '', sources)
  el('p', '来源开关只筛选旧消息。当前步注入、仍在使用的最新运行上下文，以及工具调用和结果始终保留。', sources)
  const addRow = el('div', '', sources), sourceName = el('input', '', addRow); sourceName.placeholder = '精确 source.kind'; sourceName.setAttribute('aria-label', '添加来源')
  const addSource = el('button', '添加来源', addRow)
  const content = el('fieldset', '', panel); el('legend', '保留哪些内容类型', content)
  const types = {}
  for (const [kind, name] of [['text', '正文'], ['image', '图片'], ['reasoning', '思考（协议需要或未验证时始终保留）']]) {
    const line = el('label', '', content), input = el('input', '', line); input.type = 'checkbox'; input.setAttribute('aria-label', `保留${kind}`); types[kind] = input; el('span', ` ${name} `, line)
  }
  const advanced = el('div', '', panel); advanced.className = 'history-advanced'
  advanced.append(content)
  el('h3', '助手正文片段排除（进阶版）', advanced)
  el('p', '使用精确起止标记。lines 仅匹配独立行并跳过代码围栏；literal 明确允许行内匹配。嵌套或未闭合标记保留并提示。规则默认不启用。', advanced)
  const fragments = el('textarea', '', advanced); fragments.rows = 9; fragments.setAttribute('aria-label', '片段规则 JSON')
  for (const preset of fragmentPresets) {
    const button = el('button', `添加 ${preset.name}`, advanced)
    button.onclick = () => { try { const rules = JSON.parse(fragments.value); if (!rules.some(r => r.id === preset.rule.id)) rules.push(structuredClone(preset.rule)); fragments.value = JSON.stringify(rules, null, 2); setDirty(true) } catch (error) { status.textContent = error.message } }
  }
  const actions = tabs ?? el('div', '', panel)
  const rulesButton = embedded ? el('button', '筛选规则', actions) : null
  const previewButton = el('button', '匹配预览', actions), saveButton = embedded ? null : el('button', '保存历史规则', actions)
  const show = view => { panel.dataset.view = view; rulesButton?.setAttribute('aria-pressed', String(view === 'rules')); previewButton.setAttribute('aria-pressed', String(view === 'preview')) }
  if (rulesButton) rulesButton.onclick = () => show('rules')
  show('rules')
  previewButton.disabled = true; if (saveButton) saveButton.disabled = true; addSource.disabled = true
  const status = el('p', '正在读取…', panel); status.setAttribute('role', 'status')
  const results = el('div', '', panel); results.className = 'history-results'; results.setAttribute('aria-label', '历史匹配预览')
  const reasonLabels = { SOURCE_EXCLUDED: '按来源排除旧消息', UNKNOWN_SOURCE_RETAINED: '未知来源：保留原文', REASONING_REQUIRED_OR_UNVERIFIED: '模型协议要求保留思考，或尚未验证能安全省略', SOURCE_REQUIRED_REASONING_RETAINED: '此消息含必需思考，不能整条排除', CURRENT_OR_ASSEMBLED_CONTENT: '当前步或本次装配内容：保留', PROTECTED_PROTOCOL_MESSAGE: '工具事务、系统指令或 adapter replay 数据：保留', CURRENT_RUNTIME_CONTEXT: '当前仍在使用的运行上下文：保留', AMBIGUOUS_FRAGMENT: '片段标记有歧义：保留', UNCLOSED_FRAGMENT: '片段未闭合：保留', EMPTY_AFTER_FILTER: '筛选后无剩余内容' }
  const display = message => message.content.map(block => block.type === 'text' ? block.text : block.type === 'reasoning' ? `〔思考〕\n${block.text}` : `〔${block.type}〕`).join('\n\n')
  reasonLabels.POLICY_DISABLED = '已关闭：恢复仍由本功能隐藏的消息'
  reasonLabels.NATIVE_REPLACEMENT_RETAINED = '原生压缩或其他替换结果：保留'
  reasonLabels.SOURCE_REPLAY_RETAINED = '此消息携带协议重放数据，保留消息身份与内容块'
  reasonLabels.REPLAY_BLOCKS_RETAINED = '保留协议重放所需的内容块与思考，仅允许已验证的正文片段编辑'
  function renderSources() {
    sourceRows.replaceChildren()
    const listed = new Map([['user', true], ['model', true], ...policy.sources.map(r => [r.kind, r.include])])
    for (const [kind, include] of listed) {
      const row = el('label', '', sourceRows), input = el('input', '', row); input.type = 'checkbox'; input.checked = standard && ['user', 'model'].includes(kind) ? true : include; input.disabled = standard && ['user', 'model'].includes(kind); input.dataset.kind = kind; input.setAttribute('aria-label', `保留来源 ${kind}`); el('span', ` ${kind} `, row)
    }
  }
  const draft = () => ({ version: 1, enabled: enabled.checked,
    sources: [...sourceRows.querySelectorAll('input')].map(input => ({ kind: input.dataset.kind, include: standard && ['user', 'model'].includes(input.dataset.kind) ? policy.sources.find(r => r.kind === input.dataset.kind)?.include ?? true : input.checked })),
    contentTypes: standard ? policy.contentTypes : Object.fromEntries(Object.entries(types).map(([kind, input]) => [kind, input.checked])), fragments: standard ? policy.fragments : JSON.parse(fragments.value) })
  async function call(suffix = '', method = 'GET', body) {
    const response = await request(`${root}${suffix}?sessionId=${encodeURIComponent(sessionId)}`, { method, signal: abort.signal, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
    const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.error ?? 'History API failed'); return result
  }
  addSource.onclick = () => {
    try { policy = draft(); if (!policy.sources.some(r => r.kind === sourceName.value)) policy.sources.push({ kind: sourceName.value, include: true }); renderSources(); sourceName.value = ''; setDirty(true) } catch (error) { status.textContent = error.message }
  }
  async function action(button, run) {
    button.disabled = true
    try { await run() } catch (error) { if (!disposed) status.textContent = error.message } finally { if (!disposed) button.disabled = false }
  }
  previewButton.onclick = () => action(previewButton, async () => {
    const result = await call('/preview', 'POST', { policy: draft(), ...(embedded ? { backend } : {}) }); if (disposed) return
    show('preview')
    results.replaceChildren()
    status.textContent = `预览：${standard ? result.operations.length : result.audit.decisions.filter(d => d.action !== 'keep').length} 条消息改变，${result.audit.warnings.length} 条提示。${standard ? '预览下一步的清理与恢复；未包含下一步新注入，仍保留最新运行上下文。' : '仅包含已保存的原生有效历史，不含输入框草稿。'}`
    const legend = el('div', '', results); legend.className = 'history-diff-legend'
    for (const [kind, label] of [['remove', '− 去除'], ['keep', '= 保留'], ['add', '+ 新增（恢复）']]) { const badge = el('span', label, legend); badge.className = `history-diff-${kind}` }
    for (const row of result.preview) {
      const kind = row.action === 'exclude' ? 'remove' : row.action === 'restore' ? 'add' : 'keep'
      const item = el('details', '', results); item.open = row.action !== 'keep'; item.className = `history-result history-result-${kind}`
      const actionLabel = { exclude: '去除', keep: '保留', edit: '部分去除', restore: '新增（恢复）' }[row.action] ?? row.action
      el('summary', `${row.role} · ${row.sourceKind} · ${actionLabel} · seq ${row.seq ?? '本步装配'}`, item)
      if (row.reasons.length) el('p', row.reasons.map(reason => reasonLabels[reason] ?? reason).join(' · '), item)
      const text = el('pre', '', item); text.className = 'history-diff'
      const segment = (value, color) => { if (!value) return; const span = el('span', value, text); span.className = `history-diff-${color}` }
      for (const [index, block] of row.original.content.entries()) {
        if (index) text.append(doc.createTextNode('\n\n'))
        const change = row.blocks.find(b => b.index === index)
        const content = display({ content: [block] })
        if (kind !== 'keep' || change?.action === 'exclude') { segment(content, kind === 'add' ? 'add' : 'remove'); continue }
        let offset = 0
        for (const range of change?.ranges ?? []) { segment(content.slice(offset, range.start), 'keep'); segment(content.slice(range.start, range.end), 'remove'); offset = range.end }
        segment(content.slice(offset), 'keep')
      }
    }
  })
  if (saveButton) saveButton.onclick = () => action(saveButton, async () => {
    const savingGeneration = editGeneration
    const result = await call('', 'PUT', { policy: draft(), expectedRevision: revision }); if (disposed) return
    policy = result.policy; revision = result.revision; results.replaceChildren(); if (editGeneration === savingGeneration) setDirty(false); onSaved(); status.textContent = `已保存版本 ${revision}。从下一步${standard ? '原生' : '进阶'}请求生效；同一步重试和过去的审计记录不变。${dirty ? ' 仍有保存期间的新修改待保存。' : ''}`
  })
  const ready = (value !== undefined ? Promise.resolve({ policy: value, revision: 0 }) : sessionId ? call() : Promise.resolve({ policy: DEFAULT_HISTORY_POLICY, revision: 0 })).then(result => {
    if (disposed) return
    standard = embedded ? backend === 'native' : result.capabilities?.mode === 'standard'
    title.textContent = `模型历史筛选 · ${standard ? '标准版' : '进阶版'}`
    if (standard) {
      explanation.textContent = '按可靠来源自动清理已消费的插件 user 注入。原生日志保留；保存后从下一步生效，改规则或关闭会恢复仍由本功能隐藏的消息。压缩覆盖的内容不会复原。卸载保留已写入的清理结果，原生会话可继续；需恢复时请先关闭并运行一步。'
      for (const input of advanced.querySelectorAll('input, textarea, button')) input.disabled = true
      el('p', '正文、图片、思考和 MVU 片段筛选仅在进阶版生效；标准版完整保留助手回复。', advanced)
    }
    if (embedded) explanation.textContent = '历史筛选与资源装配一起保存在策略预设中。上方「保存规则」只保存预设；「应用到当前会话」后从下一步生效。原始日志与展示原文保留。'
    revision = result.revision; policy = normalizeHistoryPolicy(result.policy); enabled.checked = policy.enabled
    for (const [kind, input] of Object.entries(types)) input.checked = standard || policy.contentTypes[kind]
    fragments.value = JSON.stringify(policy.fragments, null, 2); renderSources(); loaded = true; previewButton.disabled = !sessionId; if (saveButton) saveButton.disabled = false; addSource.disabled = false; onReady(); status.textContent = embedded ? `${standard ? '标准版：来源清理；助手正文完整保留。' : '进阶版：可筛选来源、内容类型与正文片段。'}${sessionId ? '匹配预览不修改会话。' : '尚无会话历史，可先编辑和保存；创建会话后再预览。'}${value === undefined && sessionId ? '此旧预设尚无历史设置，当前显示会话设置，保存预设时会一并收录。' : ''}` : `已读取版本 ${revision}。未知来源、工具事务和 adapter replay 数据保留。`
  }).catch(error => { if (!disposed) status.textContent = error.message })
  return { ready, getPolicy() { if (!loaded) throw new Error('历史筛选尚未读取成功，请重新打开策略页后再保存。'); return normalizeHistoryPolicy(draft()) }, isDirty: () => dirty, dispose() { disposed = true; abort.abort(); panel.remove() } }
}
