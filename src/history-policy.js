export { DEFAULT_HISTORY_POLICY, normalizeHistoryPolicy, matchHistoryFragments, filterHistory } from './history/policy.js'
export { HistoryPolicyStore } from './history/store.js'
export { createHistoryPolicyApi, createHistoryPolicyHandler, HISTORY_API_ROOT } from './history/server.js'
import { filterHistory } from './history/policy.js'

/** Independent service. readContext must read native effective messages and durable events. */
export function createHistoryPolicyService({ store, readContext, reasoningSafety = () => null }) {
  return {
    store,
    async preview(sessionId, policy) {
      const context = await readContext(sessionId), saved = store.get(sessionId)
      const safety = await reasoningSafety(context)
      const result = filterHistory({ ...context, policy: policy ?? saved.policy, reasoningSafety: { ...safety, toolsPresent: Boolean(context.tools?.length) || safety?.toolsPresent === true } })
      return { ...result, revision: saved.revision, previewScope: 'saved-native-history-only', pendingInputsIncluded: false }
    },
  }
}

/** Mount on the prepared protocol-1 core; never registers a message projection. */
export function registerHistoryPolicy(ctx, { store, runtime, readEvents, reasoningSafety = () => null }) {
  if (ctx.get('agentLoop')?.requestAssemblyVersion !== 1) throw Object.assign(new Error('Advanced history requires prepared protocol 1 core'), { code: 'HISTORY_CORE_REQUIRED' })
  const active = agent => Boolean(runtime.selected(agent.id)) && runtime.requestAssemblyAvailable(agent.id)
  const steps = new WeakMap()
  const settings = payload => {
    const key = `${payload.turn}:${payload.step}`, prior = steps.get(payload.agent)
    if (prior?.key === key) return prior.saved
    const saved = store.get(payload.agent.id); steps.set(payload.agent, { key, saved }); return saved
  }
  const stopStep = ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (!active(payload.agent) || decision?.kind === 'reject') return decision
    const saved = settings(payload), events = await readEvents(payload.agent.session)
    const previous = events.findLast(e => e.type === 'request/assembly')?.data.metadata?.historyPolicy
    // Filtering may change an earlier request prefix even though the native surface is unchanged.
    return saved.policy.enabled || previous?.applied ? { ...decision, startsRequestSeries: true } : decision
  }, { prepend: true })
  const stopRequest = ctx.on('agent/assemble-request', async (payload, next) => {
    if (!active(payload.agent)) return next()
    // One immutable rule snapshot per step, shared by retries of that step.
    const saved = settings(payload)
    const events = await readEvents(payload.agent.session)
    const currentStepSeq = events.findLast(e => e.type === 'step/start')?.seq ?? 0
    const contract = await reasoningSafety(payload)
    const result = await next()
    const filtered = filterHistory({ messages: result.messages, events, policy: saved.policy, currentStepSeq,
      reasoningSafety: { ...contract, toolsPresent: Boolean(payload.tools?.length) } })
    return { ...result, messages: filtered.messages, metadata: { ...result.metadata, historyPolicy: { ...filtered.audit, revision: saved.revision } } }
  }, { prepend: true })
  return async () => { await stopRequest(); await stopStep() }
}
