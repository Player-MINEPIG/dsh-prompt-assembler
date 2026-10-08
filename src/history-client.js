/** Framework-independent embeddable editor. Transport is injectable for authenticated desktop hosts. */
export function mountHistoryPolicyPanel(container, { sessionId, root = '/dsh-prompt-assembler/api/v1/history-policy', request = fetch, fragmentPresets = [], onDirtyChange = () => {}, onSaved = () => {} }) {
  const doc = container.ownerDocument, abort = new AbortController()
  let revision = 0, policy, disposed = false, standard = false, dirty = false, editGeneration = 0
  const setDirty = value => { if (value) editGeneration++; dirty = value; onDirtyChange(value) }
  const el = (tag, text, parent = container) => { const node = doc.createElement(tag); if (text) node.textContent = text; parent.append(node); return node }
  const panel = el('section'); panel.className = 'history-policy-panel'
  panel.addEventListener('input', () => setDirty(true))
  panel.addEventListener('change', () => setDirty(true))
  const title = el('h2', '模型历史筛选', panel)
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
  const advanced = el('div', '', panel)
  advanced.append(content)
  el('h3', '助手正文片段排除（进阶版）', advanced)
  el('p', '使用精确起止标记。lines 仅匹配独立行并跳过代码围栏；literal 明确允许行内匹配。嵌套或未闭合标记保留并提示。规则默认不启用。', advanced)
  const fragments = el('textarea', '', advanced); fragments.rows = 9; fragments.setAttribute('aria-label', '片段规则 JSON')
  for (const preset of fragmentPresets) {
    const button = el('button', `添加 ${preset.name}`, advanced)
    button.onclick = () => { try { const rules = JSON.parse(fragments.value); if (!rules.some(r => r.id === preset.rule.id)) rules.push(structuredClone(preset.rule)); fragments.value = JSON.stringify(rules, null, 2); setDirty(true) } catch (error) { status.textContent = error.message } }
  }
  const actions = el('div', '', panel), previewButton = el('button', '匹配预览', actions), saveButton = el('button', '保存历史规则', actions)
  previewButton.disabled = true; saveButton.disabled = true; addSource.disabled = true
  const status = el('p', '正在读取…', panel); status.setAttribute('role', 'status')
  const results = el('div', '', panel); results.setAttribute('aria-label', '历史匹配预览')
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
    sources: [...sourceRows.querySelectorAll('input')].map(input => ({ kind: input.dataset.kind, include: input.checked })),
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
    const result = await call('/preview', 'POST', { policy: draft() }); if (disposed) return
    results.replaceChildren()
    status.textContent = `预览：${standard ? result.operations.length : result.audit.decisions.filter(d => d.action !== 'keep').length} 条消息改变，${result.audit.warnings.length} 条提示。${standard ? '预览下一步的清理与恢复；未包含下一步新注入，仍保留最新运行上下文。' : '仅包含已保存的原生有效历史，不含输入框草稿。'}`
    for (const row of result.preview) {
      const item = el('details', '', results); item.open = row.action !== 'keep'
      el('summary', `${row.role} · ${row.sourceKind} · ${row.action} · seq ${row.seq ?? '本步装配'}`, item)
      if (row.reasons.length) el('p', row.reasons.map(reason => reasonLabels[reason] ?? reason).join(' · '), item)
      el('h4', '原文', item); el('pre', display(row.original), item)
      el('h4', '有效内容', item); el('pre', row.effective ? display(row.effective) : '本次请求不包含此消息', item)
      for (const block of row.blocks) {
        if (block.action === 'exclude') el('p', `排除内容类型：${block.type}`, item)
        for (const range of block.ranges ?? []) {
          el('p', `匹配规则：${range.ruleIds.join('、')} · 原文字符区间 ${range.start}–${range.end}`, item)
          el('pre', row.original.content[block.index].text.slice(range.start, range.end), item)
        }
      }
    }
  })
  saveButton.onclick = () => action(saveButton, async () => {
    const savingGeneration = editGeneration
    const result = await call('', 'PUT', { policy: draft(), expectedRevision: revision }); if (disposed) return
    policy = result.policy; revision = result.revision; results.replaceChildren(); if (editGeneration === savingGeneration) setDirty(false); onSaved(); status.textContent = `已保存版本 ${revision}。从下一步${standard ? '原生' : '进阶'}请求生效；同一步重试和过去的审计记录不变。${dirty ? ' 仍有保存期间的新修改待保存。' : ''}`
  })
  const ready = call().then(result => {
    if (disposed) return
    standard = result.capabilities?.mode === 'standard'
    title.textContent = `模型历史筛选 · ${standard ? '标准版' : '进阶版'}`
    if (standard) {
      explanation.textContent = '按可靠来源自动清理已消费的插件 user 注入。原生日志保留；保存后从下一步生效，改规则或关闭会恢复仍由本功能隐藏的消息。压缩覆盖的内容不会复原。卸载保留已写入的清理结果，原生会话可继续；需恢复时请先关闭并运行一步。'
      for (const input of advanced.querySelectorAll('input, textarea, button')) input.disabled = true
      el('p', '正文、图片、思考和 MVU 片段筛选仅在进阶版生效；标准版完整保留助手回复。', advanced)
    }
    revision = result.revision; policy = result.policy; enabled.checked = policy.enabled
    for (const [kind, input] of Object.entries(types)) input.checked = standard || policy.contentTypes[kind]
    fragments.value = JSON.stringify(policy.fragments, null, 2); renderSources(); previewButton.disabled = false; saveButton.disabled = false; addSource.disabled = false; status.textContent = `已读取版本 ${revision}。未知来源、工具事务和 adapter replay 数据保留。`
  }).catch(error => { if (!disposed) status.textContent = error.message })
  return { ready, isDirty: () => dirty, dispose() { disposed = true; abort.abort(); panel.remove() } }
}
