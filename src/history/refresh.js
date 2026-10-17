import { createUserMessage } from '@deepseek-ai/dsh-llm'

export const excludesSource = (policy, kind) => policy.enabled && policy.sources.some(rule => rule.kind === kind && !rule.include)

// Stock DSH refreshes facts after request preparation. Advanced filtering must
// retain that accepted value when its unchanged durable snapshot is historical.
export function refreshRuntimeContext(messages, session, policy, currentStepSeq) {
  if (!excludesSource(policy, 'runtime-context')) return messages
  const latest = session.deriveMessages().findLast(m => m.source?.kind === 'runtime-context')
  if (!latest || latest.role !== 'user' || latest.source?.replayState !== undefined || latest.content.some(b => !['text', 'image'].includes(b.type))) return messages
  const seq = [...session.surface.nodes].find(seq => session.eventAt(seq)?.data?.id === latest.id)
  if (seq === undefined || seq >= currentStepSeq || !messages.some(m => m.id === latest.id)) return messages
  const message = createUserMessage({ content: structuredClone(latest.content), source: structuredClone(latest.source) })
  return [...messages, message]
}
