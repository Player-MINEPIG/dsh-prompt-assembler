/** Whole-node ordering only: note reads/authorization belong to their source. */
export function registerNotesLast(strategies) {
  return strategies.register({
    id: 'example.notes-last', pluginId: 'example.notes', name: ['笔记放在末尾', 'Notes last'],
    execute({ nodes, remainingNodeIds }) {
      const remaining = new Set(remainingNodeIds)
      const claimedNodeIds = nodes.filter(n => remaining.has(n.id) && n.source?.module === 'example.notes').map(n => n.id)
      const claimed = new Set(claimedNodeIds)
      return { claimedNodeIds, order: [...nodes.filter(n => !claimed.has(n.id)), ...nodes.filter(n => claimed.has(n.id))].map(n => n.id) }
    },
  })
}
