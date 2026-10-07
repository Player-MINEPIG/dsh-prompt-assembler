import { CoreRequestBackend } from './backend.js'
export const name = 'dsh-prompt-assembler-core'
export const inject = ['dshPromptAssembler', 'agentLoop']
export function apply(ctx) {
  const runtime = ctx.get('dshPromptAssembler').runtime
  const backend = new CoreRequestBackend(runtime)
  backend.requireAvailable()
  ctx.effect(() => runtime.registerRequestBackend(backend))
  ctx.on('agent/assemble-request', (payload, next) => runtime.execute(payload, next))
  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (decision?.kind === 'reject' || payload.signal?.aborted || !runtime.requestAssemblyAvailable(payload.agent.id)) return decision
    return backend.startsSeries(payload.agent) ? { ...decision, startsRequestSeries: true } : decision
  })
}
export default { name, inject, apply }
