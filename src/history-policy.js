export { DEFAULT_HISTORY_POLICY, normalizeHistoryPolicy, matchHistoryFragments, filterHistory } from './history/policy.js'
export { HistoryPolicyStore } from './history/store.js'
export { createHistoryPolicyApi, createHistoryPolicyHandler, HISTORY_API_ROOT } from './history/server.js'
import { isDeepStrictEqual } from 'node:util'
import { filterHistory, normalizeHistoryPolicy } from './history/policy.js'
import { planStandardHistory } from './history/standard.js'
export { planStandardHistory, applyStandardHistory, registerStandardHistoryPolicy } from './history/standard.js'

/** Independent service. readContext must read native effective messages and durable events. */
export function createHistoryPolicyService({ store, readContext, reasoningSafety = () => null, mode = 'advanced' }) {
  if (!['standard', 'advanced'].includes(mode)) throw new TypeError('Invalid history mode')
  const capabilities = { mode, sourceCleanup: true, contentFiltering: mode === 'advanced', fragmentFiltering: mode === 'advanced' }
  const validate = (sessionId, input) => {
    const policy = normalizeHistoryPolicy(input), previous = store.get(sessionId).policy
    if (mode === 'standard' && (!isDeepStrictEqual(policy.contentTypes, previous.contentTypes) || !isDeepStrictEqual(policy.fragments, previous.fragments))) {
      throw Object.assign(new Error('Content and fragment rules require advanced mode'), { status: 400, code: 'HISTORY_ADVANCED_REQUIRED' })
    }
    return policy
  }
  return {
    store, capabilities,
    save(sessionId, input, revision) { return store.save(sessionId, validate(sessionId, input), revision) },
    async preview(sessionId, policy) {
      const context = await readContext(sessionId), saved = store.get(sessionId)
      if (mode === 'standard') return { ...planStandardHistory({ ...context, policy: normalizeHistoryPolicy(policy ?? saved.policy), revision: saved.revision }), revision: saved.revision, capabilities, previewScope: 'next-native-step', pendingInputsIncluded: false }
      const safety = await reasoningSafety(context)
      // An advanced selection restores standard tombstones on its next pre-step.
      const restored = context.nodes ? planStandardHistory({ ...context, policy: { ...saved.policy, enabled: false } }).messages : context.messages
      const result = filterHistory({ ...context, messages: restored, policy: policy ?? saved.policy, reasoningSafety: { ...safety, toolsPresent: Boolean(context.tools?.length) || safety?.toolsPresent === true } })
      return { ...result, capabilities, revision: saved.revision, previewScope: 'saved-native-history-only', pendingInputsIncluded: false }
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
