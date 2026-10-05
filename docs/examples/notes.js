/** Example adapter: the source owns reads and parsing; the assembler owns placement. */
export function registerNotes(registry, notes) {
  const output = rows => ({ blocks: rows.map(row => ({ id: row.id, type: 'text', text: row.text, role: 'system', source: { resourceId: row.id, field: 'text' } })) })
  return registry.register({
    id: 'example.notes', pluginId: 'example.notes', name: 'Notes', multiple: true,
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
