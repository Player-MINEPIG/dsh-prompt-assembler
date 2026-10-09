import { createHash } from 'node:crypto'
import { supportsReplayTextEdits } from './replay.js'

const clone = value => structuredClone(value)
export const historyHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export { DEFAULT_HISTORY_POLICY, normalizeHistoryPolicy } from './schema.js'
import { normalizeHistoryPolicy } from './schema.js'

// Exact delimiters, not regex. Line mode deliberately ignores quoted inline examples.
// Nested/unbalanced delimiters preserve the entire block, not a guessed partial range.
export function matchHistoryFragments(text, rule) {
  const tokens = []
  if (rule.mode === 'lines') {
    let offset = 0, fenced = false
    for (const line of text.split('\n')) {
      const value = line.replace(/\r$/, '')
      if (/^(```|~~~)/.test(value)) fenced = !fenced
      if (!fenced && [rule.start, rule.end].includes(value)) {
        tokens.push({ type: value === rule.start ? 'start' : 'end', offset, end: offset + line.length + (offset + line.length < text.length ? 1 : 0) })
      }
      offset += line.length + 1
    }
  } else {
    for (const [type, delimiter] of [['start', rule.start], ['end', rule.end]]) {
      let from = 0, index
      while ((index = text.indexOf(delimiter, from)) !== -1) { tokens.push({ type, offset: index, end: index + delimiter.length }); from = index + delimiter.length }
    }
    tokens.sort((a, b) => a.offset - b.offset)
  }
  let open = null
  const ranges = []
  for (const token of tokens) {
    if (token.type === 'start') {
      if (open !== null) return { ranges: [], warning: 'AMBIGUOUS_FRAGMENT' }
      open = token
    } else {
      if (open === null || token.offset < open.end) return { ranges: [], warning: 'AMBIGUOUS_FRAGMENT' }
      ranges.push({ start: open.offset, end: token.end, ruleId: rule.id }); open = null
    }
  }
  return open === null ? { ranges } : { ranges: [], warning: 'UNCLOSED_FRAGMENT' }
}

function mergedRanges(ranges) {
  const result = []
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    const previous = result.at(-1)
    if (previous && range.start < previous.end) { previous.end = Math.max(previous.end, range.end); previous.ruleIds.push(range.ruleId) }
    else result.push({ start: range.start, end: range.end, ruleIds: [range.ruleId] })
  }
  return result
}
const messageOf = event => event.type === 'user/message' ? event.data : event.data?.message

/** Pure copy-on-request filtering. No Session mutations or projection registrations. */
export function filterHistory({ messages, events, policy: input, currentStepSeq = Infinity, reasoningSafety = null, retainCurrentSystem = false }) {
  const policy = normalizeHistoryPolicy(input), original = clone(messages)
  const eventById = new Map()
  for (const event of events) {
    if (!['user/message', 'assistant/message', 'system/message', 'developer/message', 'tool/result'].includes(event.type)) continue
    const message = messageOf(event)
    if (message?.id) eventById.set(message.id, event)
  }
  const warnings = [], decisions = [], output = [], preview = []
  const known = new Set(['user', 'model', 'tool', 'system-prompt', ...policy.sources.map(r => r.kind)])
  const sources = new Map(policy.sources.map(r => [r.kind, r.include]))
  // A caller cannot override a tool-bearing request with an unsafe capability claim.
  const transactionPresent = original.some(m => m.role === 'tool' || m.content?.some(b => b.type === 'tool-call'))
  const canOmitReasoning = reasoningSafety?.canOmit === true && typeof reasoningSafety.contract === 'string' && reasoningSafety.contract.length > 0 && !reasoningSafety.toolsPresent && !transactionPresent
  // Native system projection has reconciled this step's effective prompt before assembly.
  const currentSystemId = retainCurrentSystem ? original.findLast(m => m.role === 'system' && m.source?.kind === 'system-prompt' && m.content.length)?.id : null
  for (const message of original) {
    const event = eventById.get(message.id), kind = message.source?.kind ?? 'unknown'
    const decision = { messageId: message.id, seq: event?.seq ?? null, sourceKind: kind, role: message.role, beforeHash: historyHash(message), action: 'keep', blocks: [], reasons: [] }
    const warn = code => { warnings.push({ code, messageId: message.id, seq: decision.seq }); decision.reasons.push(code) }
    const old = event && event.seq < currentStepSeq
    const replayTextOnly = supportsReplayTextEdits(message)
    const protectedMessage = message.id === currentSystemId || (message.role === 'system' && (kind !== 'system-prompt' || sources.get(kind) !== false)) || message.role === 'developer' || message.role === 'tool' || message.content?.some(b => b.type === 'tool-call') || (message.source?.replayState !== undefined && !replayTextOnly)
    let changed = clone(message)
    if (policy.enabled && old && !protectedMessage) {
      if (!known.has(kind)) warn('UNKNOWN_SOURCE_RETAINED')
      else if (sources.get(kind) === false) {
        if (replayTextOnly) warn('SOURCE_REPLAY_RETAINED')
        else if (!canOmitReasoning && message.content.some(b => b.type === 'reasoning')) warn('SOURCE_REQUIRED_REASONING_RETAINED')
        else { changed = null; decision.action = 'exclude'; decision.reasons.push('SOURCE_EXCLUDED') }
      }
      if (changed && known.has(kind)) {
        changed.content = message.content.flatMap((block, index) => {
          if (policy.contentTypes[block.type] === false) {
            if (replayTextOnly) warn('REPLAY_BLOCKS_RETAINED')
            else if (block.type === 'reasoning' && !canOmitReasoning) warn('REASONING_REQUIRED_OR_UNVERIFIED')
            else { decision.blocks.push({ index, type: block.type, action: 'exclude' }); return [] }
          }
          if (block.type !== 'text' || message.role !== 'assistant') return [clone(block)]
          const ranges = []
          for (const rule of policy.fragments.filter(r => r.enabled && r.sourceKind === kind)) {
            const matched = matchHistoryFragments(block.text, rule)
            if (matched.warning) warn(matched.warning)
            ranges.push(...matched.ranges)
          }
          const merged = mergedRanges(ranges)
          if (!merged.length) return [clone(block)]
          let cursor = 0, kept = ''
          for (const range of merged) { kept += block.text.slice(cursor, range.start); cursor = range.end }
          kept += block.text.slice(cursor)
          decision.blocks.push({ index, type: 'text', action: 'edit', ranges: merged, beforeHash: historyHash(block.text), afterHash: historyHash(kept) })
          return kept || replayTextOnly ? [{ ...block, text: kept }] : []
        })
        if (!changed.content.length) { changed = null; decision.action = 'exclude'; decision.reasons.push('EMPTY_AFTER_FILTER') }
        else if (decision.blocks.length) decision.action = 'edit'
      }
    } else if (policy.enabled) {
      decision.reasons.push(!old ? 'CURRENT_OR_ASSEMBLED_CONTENT' : message.id === currentSystemId ? 'CURRENT_SYSTEM_PROMPT' : 'PROTECTED_PROTOCOL_MESSAGE')
    }
    if (changed) output.push(changed)
    decision.afterHash = changed ? historyHash(changed) : null
    decisions.push(decision)
    preview.push({ ...decision, original: message, effective: changed })
  }
  if (!output.length && original.length) throw Object.assign(new Error('History policy would leave an empty request'), { status: 409, code: 'HISTORY_POLICY_EMPTY' })
  return { messages: output, preview, audit: { version: 1, policy, policyHash: historyHash(policy), applied: policy.enabled, scope: 'current-native-surface', currentStepSeq: Number.isFinite(currentStepSeq) ? currentStepSeq : null,
    reasoningSafety: { canOmit: canOmitReasoning, contract: reasoningSafety?.contract ?? null }, beforeHash: historyHash(original), afterHash: historyHash(output), decisions, warnings } }
}
