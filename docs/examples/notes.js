/** Example adapter: the source owns reads and parsing; the assembler owns placement. */
export function registerNotes(registry, notes) {
  const output = rows => ({ blocks: rows.map(row => ({ id: row.id, type: 'text', text: row.text, role: 'system', source: { resourceId: row.id, field: 'text' } })) })
  return registry.register({
    id: 'example.notes', pluginId: 'example.notes', name: 'Notes', multiple: true,
    contentGuide: {
      contains: ['当前会话可读取的笔记正文。', 'Readable note text for the current session.'],
      origin: ['接入方提供的 notes.read 存储。', 'The notes.read store supplied by the integration.'],
      editable: ['本示例只提供读取与解析，没有正文写入能力。', 'This example supports reading and parsing, not writing note content.'],
      editAt: ['在接入方的笔记应用中修改；assembler 不提供编辑器。', 'Edit in the integrating notes application; assembler provides no note editor.'],
    },
    async resolve(context) {
      return output(await notes.read({ sessionId: context.sessionId, signal: context.signal }))
    },
    async parseText(context, rule) {
      // This is the source's own language, distinct from ST macros or DSH variables.
      const rows = await notes.read({ sessionId: context.sessionId, signal: context.signal })
      const text = rule.text.replace(/\[\[([^\]]+)\]\]/g, (_, id) => {
        const row = rows.find(row => row.id === id)
        if (!row) throw new Error(`Unknown note: ${id}`)
        return row.text
      })
      return output([{ id: 'custom', text }])
    },
    renderText: ({ text }) => text,
  })
}
