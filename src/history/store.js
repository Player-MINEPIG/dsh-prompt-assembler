import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { normalizeHistoryPolicy, DEFAULT_HISTORY_POLICY } from './policy.js'

export class HistoryPolicyStore {
  constructor(directory) {
    this.directory = directory; this.path = join(directory, 'history-policies.json')
    try { this.data = JSON.parse(readFileSync(this.path, 'utf8')) }
    catch (error) { if (error.code !== 'ENOENT') throw error; this.data = { version: 1, sessions: {} } }
    if (this.data.version !== 1 || !this.data.sessions || typeof this.data.sessions !== 'object' || Array.isArray(this.data.sessions)) throw new Error('Unsupported history policy store')
    for (const entry of Object.values(this.data.sessions)) {
      if (!Number.isSafeInteger(entry?.revision) || entry.revision < 1) throw new Error('Invalid history policy revision')
      normalizeHistoryPolicy(entry.policy)
    }
  }
  get(sessionId) { return structuredClone(Object.hasOwn(this.data.sessions, sessionId) ? this.data.sessions[sessionId] : { revision: 0, policy: DEFAULT_HISTORY_POLICY }) }
  save(sessionId, input, expectedRevision) {
    if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 512) throw Object.assign(new Error('Session id required'), { status: 400 })
    const previous = this.get(sessionId)
    if (expectedRevision !== previous.revision) throw Object.assign(new Error('History policy changed; reload before saving'), { status: 409, code: 'HISTORY_POLICY_CONFLICT' })
    const entry = { revision: previous.revision + 1, policy: normalizeHistoryPolicy(input) }
    const next = structuredClone(this.data)
    Object.defineProperty(next.sessions, sessionId, { value: entry, enumerable: true, configurable: true, writable: true })
    mkdirSync(this.directory, { recursive: true })
    const temporary = `${this.path}.${randomUUID()}.tmp`
    writeFileSync(temporary, JSON.stringify(next, null, 2), { mode: 0o600 }); renameSync(temporary, this.path)
    this.data = next
    return structuredClone(entry)
  }
}
