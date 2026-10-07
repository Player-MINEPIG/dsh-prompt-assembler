import { assembleRequestAsync } from './assemble.js'
import { normalizePreset } from './model.js'
import { projectSystemSnapshots } from './system-snapshots.js'
import { createHash } from 'node:crypto'

/** Protocol-1 executor extracted from the validated advanced assembler. */
export class CoreRequestBackend {
  id = 'core'
  constructor(runtime) { this.runtime = runtime }
  get ctx() { return this.runtime.ctx }
  get store() { return this.runtime.store }
  get resources() { return this.runtime.resources }
  get registry() { return this.runtime.registry }
  get owner() { return this.runtime.owner }
  get afterAssembly() { return this.runtime.afterAssembly }
  selected(id) { return this.runtime.selected(id) }
  available() { return this.ctx.get('agentLoop')?.requestAssemblyVersion === 1 }
  requireAvailable() {
    if (!this.available()) throw Object.assign(new Error('Core assembly requires the explicitly prepared DSH request assembly protocol 1 runtime.'), { status: 409, code: 'REQUEST_ASSEMBLY_CORE_REQUIRED' })
  }
  startsSeries(agent) {
    const selected = this.selected(agent.id)
    const last = agent.session.snapshotEvents().findLast(e => e.type === 'request/assembly')?.data.metadata
    const revision = selected ? createHash('sha256').update(JSON.stringify(normalizePreset(selected))).digest('hex') : null
    return revision !== ([this.owner, 'pmp-dsh-tavern', 'dsh-prompt-assembler'].includes(last?.owner) ? last.assembly.preset.revision : null)
  }
  async execute(payload, next) {
    const base = await next(), preset = this.selected(payload.agent.id)
    if (!preset) return base
    this.requireAvailable()
    const snapshot = this.resources.assembledFor(payload.agent)
    if (!snapshot?.assemblyInput) throw new Error('Resource snapshot missing at request assembly')
    const events = payload.agent.session.snapshotEvents()
    const start = events.findLast(e => e.type === 'step/start')?.seq ?? -1
    const inputIds = events.filter(e => e.seq > start && e.type === 'user/message').map(e => e.data.id)
    const lastMetadata = events.findLast(e => e.type === 'request/assembly')?.data.metadata
    const previous = [this.owner, 'pmp-dsh-tavern', 'dsh-prompt-assembler'].includes(lastMetadata?.owner) ? lastMetadata.assembly : null
    const assets = { ...snapshot.assemblyInput, diagnostics: snapshot.diagnostics, officialSections: snapshot.officialAssembly?.sections ?? [], nativeVariables: snapshot.officialAssembly?.variables ?? snapshot.assemblyInput.nativeVariables ?? {} }
    const logical = await assembleRequestAsync({ registry: this.registry, afterAssembly: this.afterAssembly, sessionId: payload.agent.id, turn: payload.turn, step: payload.step, signal: payload.signal, preset, assets, nativeMessages: base.messages, inputIds, previous, snapshots: previous?.snapshots ?? [], maxBytes: this.resources.maxProfileBytes })
    // Complete snapshots repeat active instructions; their physical ceiling is independent of logical admission.
    const assembly = projectSystemSnapshots(logical, base.messages, undefined, { systemPromptUpdate: payload.agent.session.requestContext?.()?.systemPromptUpdate })
    if (!assembly.messages.length) throw Object.assign(new Error('提示词装配结果为空：请启用或填写至少一条内容。The assembled request is empty; enable or fill at least one item.'), { code: 'ASSEMBLY_EMPTY' })
    const { messages, ...metadata } = assembly
    this.runtime.validateResult?.({ messages, metadata: { assembly: metadata } }, payload.agent)
    return { messages, metadata: { owner: this.owner, assembly: metadata, upstream: base.metadata ?? null } }
  }
}
