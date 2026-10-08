const textOf = message => (message.content ?? []).map(block => block.type === 'text' ? block.text : `[${block.type}]`).join('\n')

/** Layout provenance is captured before history filtering. Display only final request bytes. */
export function actualAssemblyResult(record) {
  const result = record.metadata?.assembly ?? { diagnostics: [], nodes: record.messages.map((m, index) => ({
    id: m.id ?? `actual-${index}`, module: m.role === 'system' ? 'native-system' : 'history',
    name: m.role === 'system' || m.source?.form === 'snapshot' ? 'source-unrecorded' : m.role,
    role: m.role, source: { plugin: m.source?.plugin ?? 'DSH', field: m.source?.kind },
    stability: 'snapshot', lifetime: 'native', locked: true, text: textOf(m), messages: [m],
  })) }
  const changed = new Set((record.metadata?.historyPolicy?.decisions ?? []).filter(d => d.action !== 'keep').map(d => d.messageId))
  const finalById = new Map(record.messages.map(m => [m.id, m]))
  const nodes = (result.nodes ?? []).flatMap(node => {
    if (!node.messages?.some(m => changed.has(m.id))) return [node]
    const messages = node.messages.flatMap(m => changed.has(m.id) ? finalById.has(m.id) ? [finalById.get(m.id)] : [] : [m])
    return messages.length ? [{ ...node, messages, text: messages.map(textOf).join('\n\n'), historyFiltered: true }] : []
  })
  return { ...result, diagnostics: result.diagnostics ?? [], nodes, messages: record.messages, historyPolicy: record.metadata?.historyPolicy, actual: true }
}
