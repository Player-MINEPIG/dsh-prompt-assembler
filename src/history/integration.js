import { createDeveloperMessage } from '@deepseek-ai/dsh-llm'
import { HistoryPolicyStore, createHistoryPolicyService, createHistoryPolicyHandler, registerStandardHistoryPolicy } from '../history-policy.js'

/** Shared state for the stock lifecycle and the optional request backend. */
export function connectHistoryPolicy(ctx, { runtime, storageDir }) {
  const store = new HistoryPolicyStore(storageDir)
  const inspect = async id => {
    try { return await ctx.get('sessionController').inspect(id) }
    catch (error) {
      if (['SESSION_QUERY_SESSION_NOT_FOUND', 'SCOPE_CATALOG_NOT_FOUND'].includes(error.code) || error.constructor?.name === 'ApiSessionNotFound') error.status = 404
      throw error
    }
  }
  const readEvents = async session => (await inspect(session.id)).events
  const readContext = async id => {
    const record = await inspect(id), sessions = ctx.get('sessions')
    const agent = ctx.get('agents')?.get(id)
    const session = agent?.session ?? sessions.get(id) ?? sessions.prepare(id, { seed: record.events, meta: record.meta, inheritedEventCount: record.inheritedEventCount, eventState: 'detached' })
    return { nodes: [...session.surface.nodes], messages: session.deriveMessages(), events: record.events,
      currentStepSeq: agent?.status === 'running' ? record.events.findLast(e => e.type === 'step/start')?.seq ?? Infinity : Infinity }
  }
  const advanced = id => Boolean(runtime.selected(id)) && runtime.requestAssemblyAvailable(id)
  const services = Object.fromEntries(['standard', 'advanced'].map(mode => [mode, createHistoryPolicyService({ store, readContext, mode })]))
  const handler = createHistoryPolicyHandler({ service: async id => {
    await inspect(id) // Validate even GET/save; opening settings must not create an Agent.
    return services[advanced(id) ? 'advanced' : 'standard']
  } })
  ctx.effect(() => registerStandardHistoryPolicy(ctx, { store, readEvents, createDeveloperMessage, active: agent => !advanced(agent.id) }))
  return { store, readEvents, readContext, services, handler }
}
