import { historyHash } from './policy.js'
import { normalizeHistoryPolicy } from './schema.js'

/** Applied strategy snapshots own new policies; old selections retain their session policy. */
export function presetHistoryStore(legacy, assembly) {
  const get = sessionId => {
    const policy = assembly.selection(sessionId)?.historyPolicy
    return policy === undefined ? legacy.get(sessionId) : {
      // A content revision also detects changes made through strategy application.
      revision: Number.parseInt(historyHash(policy).slice(0, 12), 16),
      policy: structuredClone(policy),
    }
  }
  return {
    get,
    save(sessionId, input, expectedRevision) {
      const selected = assembly.selection(sessionId)
      if (selected?.historyPolicy === undefined) return legacy.save(sessionId, input, expectedRevision)
      if (get(sessionId).revision !== expectedRevision) throw Object.assign(new Error('History policy changed; reload before saving'), { status: 409, code: 'HISTORY_POLICY_CONFLICT' })
      // Keep the legacy direct-session API useful without altering the library preset.
      assembly.applySnapshot(sessionId, { ...selected, historyPolicy: normalizeHistoryPolicy(input) })
      return get(sessionId)
    },
  }
}
