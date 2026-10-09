import { createUserMessage } from '@deepseek-ai/dsh-llm'

export const excludesSource = (policy, kind) => policy.enabled && policy.sources.some(rule => rule.kind === kind && !rule.include)

// DSH computes runtime context before pre-step and reuses its old node if unchanged.
// Move that value into this step before excluding its historical copy.
export function refreshRuntimeContext(decision, session, policy, cutoffSeq) {
  if (!excludesSource(policy, 'runtime-context') || decision.messages.some(m => m.source?.kind === 'runtime-context')) return decision
  const latest = session.deriveMessages().findLast(m => m.source?.kind === 'runtime-context')
  if (!latest || latest.role !== 'user' || latest.source?.replayState !== undefined || latest.content.some(b => !['text', 'image'].includes(b.type))) return decision
  const seq = [...session.surface.nodes].find(seq => session.eventAt(seq)?.data?.id === latest.id)
  if (seq === undefined || seq > cutoffSeq) return decision
  const message = createUserMessage({ content: structuredClone(latest.content), source: structuredClone(latest.source) })
  return { ...decision, messages: [...decision.messages, message] }
}
