import { historyHash, normalizeHistoryPolicy } from './policy.js'

const OWNER = 'dsh-prompt-assembler/history-policy'
const clone = value => structuredClone(value)
const messageOf = event => event.type === 'user/message' ? event.data : event.data?.message
const protectedKinds = new Set(['user', 'model', 'system-prompt'])

// This annotation is inert data on a built-in event, never a custom interpreter.
function marker(event, bySeq) {
  const value = event?.type === 'developer/message' && event.data.historyPolicy
  if (!value || value.owner !== OWNER || value.version !== 1 || value.action !== 'hide' ||
      event.data.message?.role !== 'developer' || event.data.message.content?.length !== 0 ||
      event.surfaceOp?.op !== 'replace' || event.surfaceOp.startSeq !== value.targetSeq || event.surfaceOp.endSeq !== value.targetSeq ||
      !event.sourceEventSeqs?.includes(value.targetSeq) || !event.sourceEventSeqs.includes(value.originalSeq) ||
      value.message?.role !== 'user' || value.message.id !== messageOf(bySeq.get(value.originalSeq))?.id ||
      historyHash(value.message) !== value.messageHash) return null
  return value
}
function origin(event, bySeq) {
  if (event.surfaceOp === 'append') return event.seq
  // Only undo our own exact restoration; other replacement/compaction nodes are opaque.
  for (const seq of event.sourceEventSeqs ?? []) {
    const hidden = marker(bySeq.get(seq), bySeq)
    if (hidden && event.surfaceOp?.startSeq === seq && event.surfaceOp.endSeq === seq && historyHash(event.data) === hidden.messageHash) return hidden.originalSeq
  }
  return null
}

/** Pure plan over the CURRENT native surface, including our empty tombstones. */
export function planStandardHistory({ events, nodes, messages, policy: input, pendingMessages = [], cutoffSeq, revision = 0 }) {
  if (!Array.isArray(nodes)) throw new TypeError('Standard history requires native surface nodes')
  const policy = normalizeHistoryPolicy(input), bySeq = new Map(events.map(e => [e.seq, e]))
  const byId = new Map(messages.map(m => [m.id, m]))
  // Anything appended since the last finished step has not yet been consumed.
  const cutoff = cutoffSeq ?? events.findLast(e => e.type === 'step/end')?.seq ?? -1
  const rows = nodes.map(seq => {
    const event = bySeq.get(seq)
    if (!event) throw new Error('Incomplete event window for native history surface')
    const hidden = marker(event, bySeq)
    const raw = hidden?.message ?? messageOf(event ?? {})
    const message = hidden ? raw : byId.get(raw?.id)
    return { event, hidden, message, originalSeq: hidden?.originalSeq ?? (event?.type === 'user/message' ? origin(event, bySeq) : null) }
  }).filter(row => row.message)
  const activeRuntime = [...rows.map(row => row.message), ...pendingMessages].findLast(m => m.source?.kind === 'runtime-context')?.id
  const sources = new Map(policy.sources.map(rule => [rule.kind, rule.include]))
  const known = new Set([...protectedKinds, 'tool', 'runtime-context', 'dsh-prompt-assembler', 'ptc-mode', ...sources.keys()])
  const operations = [], warnings = [], preview = [], output = []
  for (const row of rows) {
    const { event, hidden, message, originalSeq } = row, kind = message.source?.kind ?? 'unknown'
    const reasons = []
    const warn = code => { warnings.push({ code, messageId: message.id, seq: event.seq }); reasons.push(code) }
    const protectedMessage = message.role !== 'user' || protectedKinds.has(kind) || message.source?.replayState !== undefined || message.content.some(b => ['tool-call', 'tool-result', 'reasoning'].includes(b.type))
    let exclude = false
    if (!policy.enabled) reasons.push('POLICY_DISABLED')
    else if (protectedMessage) reasons.push('PROTECTED_PROTOCOL_MESSAGE')
    else if (!known.has(kind)) warn('UNKNOWN_SOURCE_RETAINED')
    else if (originalSeq === null) reasons.push('NATIVE_REPLACEMENT_RETAINED')
    else if (originalSeq > cutoff) reasons.push('CURRENT_OR_ASSEMBLED_CONTENT')
    else if (message.id === activeRuntime) reasons.push('CURRENT_RUNTIME_CONTEXT')
    else if (sources.get(kind) === false) { exclude = true; reasons.push('SOURCE_EXCLUDED') }
    const action = exclude ? 'exclude' : hidden ? 'restore' : 'keep'
    if (exclude && !hidden) operations.push({ action: 'hide', targetSeq: event.seq, originalSeq, message: clone(message) })
    if (!exclude && hidden) operations.push({ action: 'restore', targetSeq: event.seq, originalSeq, message: clone(message) })
    if (!exclude) output.push(clone(message))
    preview.push({ messageId: message.id, seq: event.seq, originalSeq, sourceKind: kind, role: message.role, action, blocks: [], reasons,
      original: clone(message), effective: exclude ? null : clone(message), beforeHash: hidden ? null : historyHash(message), afterHash: exclude ? null : historyHash(message) })
  }
  return { messages: output, preview, operations, audit: { version: 1, mode: 'standard', applied: policy.enabled, revision, policy, policyHash: historyHash(policy), cutoffSeq: cutoff,
    scope: 'current-native-surface', decisions: preview.map(({ original, effective, ...decision }) => decision), warnings } }
}

/** All appends are synchronous: no concurrent await between planning and replacements. */
export function applyStandardHistory(session, context, { createDeveloperMessage }) {
  const plan = planStandardHistory({ ...context, nodes: [...session.surface.nodes], messages: session.deriveMessages() })
  const committed = []
  for (const operation of plan.operations) {
    const { action, targetSeq, originalSeq, message } = operation
    const intent = { surfaceOp: { op: 'replace', startSeq: targetSeq, endSeq: targetSeq }, sourceEventSeqs: [...new Set([targetSeq, originalSeq])] }
    const event = action === 'hide'
      ? session.append('developer/message', { turn: context.turn ?? 0, step: context.step ?? 0, message: createDeveloperMessage({ content: [], source: { kind: OWNER } }),
        historyPolicy: { owner: OWNER, version: 1, action, targetSeq, originalSeq, message, messageHash: historyHash(message), revision: context.revision ?? 0, policy: plan.audit.policy, policyHash: plan.audit.policyHash } }, intent)
      : session.append('user/message', message, intent)
    committed.push({ ...operation, seq: event.seq })
  }
  return { ...plan, committed }
}

/** Public stock pre-step seam; compose outside injection hooks so next() finishes first. */
export function registerStandardHistoryPolicy(ctx, { store, readEvents, createDeveloperMessage, active = () => true }) {
  if (typeof createDeveloperMessage !== 'function') throw new TypeError('Pass the Host llm.createDeveloperMessage factory')
  return ctx.on('agent/pre-step', async (payload, next) => {
    const saved = store.get(payload.agent.id)
    // Switching to advanced mode restores our native tombstones before request assembly.
    if (!active(payload.agent)) saved.policy.enabled = false
    const initial = await readEvents(payload.agent.session)
    const cutoffSeq = initial.findLast(e => e.type === 'step/end')?.seq ?? -1
    const decision = await next()
    if (decision?.kind !== 'enter') return decision
    payload.signal?.throwIfAborted()
    const events = await readEvents(payload.agent.session)
    payload.signal?.throwIfAborted()
    const result = applyStandardHistory(payload.agent.session, { ...saved, events, cutoffSeq, pendingMessages: decision.messages, turn: payload.turn, step: payload.step }, { createDeveloperMessage })
    return result.committed.length ? { ...decision, startsRequestSeries: true } : decision
  }, { prepend: true })
}
