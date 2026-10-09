import { applyResourceAnchors } from './resource-positions.js'

export const STRATEGY_SERVICE = 'dshPromptStrategies'
export const STRATEGY_PROTOCOL_VERSION = 1
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,159}$/
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) freeze(child) }
  return value
}

/** Algorithms are Host callbacks; only detached metadata crosses the client API. */
export class PositionStrategyRegistry {
  #entries = new Map()
  get version() { return STRATEGY_PROTOCOL_VERSION }
  register(definition) {
    if (!definition || typeof definition.id !== 'string' || !idPattern.test(definition.id) || definition.id === 'user' || typeof definition.pluginId !== 'string' || !idPattern.test(definition.pluginId) || !Array.isArray(definition.name) || definition.name.length !== 2 || definition.name.some(s => typeof s !== 'string' || !s) || typeof definition.execute !== 'function') throw new TypeError('Strategy requires id, pluginId, bilingual name and execute')
    if (this.#entries.has(definition.id)) throw new TypeError(`Duplicate position strategy: ${definition.id}`)
    const descriptor = freeze(structuredClone({ id: definition.id, pluginId: definition.pluginId, name: definition.name }))
    const entry = Object.freeze({ descriptor, execute: definition.execute })
    this.#entries.set(definition.id, entry)
    return () => { if (this.#entries.get(definition.id) === entry) this.#entries.delete(definition.id) }
  }
  list() { return structuredClone([...this.#entries.values()].map(e => e.descriptor)) }
  /** A request captures callbacks once; unloading affects only subsequent requests. */
  snapshot() {
    const entries = new Map(this.#entries)
    return Object.freeze({
      list: () => structuredClone([...entries.values()].map(e => e.descriptor)),
      execute(id, context) {
        const entry = entries.get(id)
        if (!entry) throw Object.assign(new Error(`Position strategy unavailable: ${id}`), { code: 'POSITION_STRATEGY_UNAVAILABLE', status: 409 })
        const result = entry.execute(freeze(structuredClone(context)))
        if (result?.then) { result.catch?.(() => {}); throw new TypeError('Position strategies must execute synchronously') }
        try { return structuredClone(result) }
        catch { throw Object.assign(new TypeError(`Invalid position strategy result: ${id}`), { code: 'POSITION_STRATEGY_INVALID', status: 409 }) }
      },
    })
  }
}

/** Built-ins use the same registration and execution contract as extensions. */
export function createPositionStrategyRegistry() {
  const registry = new PositionStrategyRegistry(), pluginId = 'dsh-prompt-assembler'
  registry.register({ id: 'preset', pluginId, name: ['预设插槽与宏引用', 'Preset slots and macro references'], execute: ({ nodes, remainingNodeIds }) => { const remaining = new Set(remainingNodeIds); return { claimedNodeIds: nodes.filter(n => remaining.has(n.id) && (n.slotId || n.slotOwner || n.placementSource === 'preset')).map(n => n.id) } } })
  registry.register({ id: 'resource', pluginId, name: ['资源自带位置与深度', 'Resource position and depth'], execute: context => {
    const nodes = structuredClone(context.nodes), diagnostics = [], remaining = new Set(context.remainingNodeIds)
    const active = new Set(nodes.filter(n => remaining.has(n.id) && (n.resourceAnchor || n.depth != null || n.nativeRequestedDepth != null)))
    applyResourceAnchors(nodes, context.preset, diagnostics, active, context.logical)
    const claimed = [...active].filter(n => n.positionDecision === 'resource' || n.depth != null || n.nativeRequestedDepth != null)
    return { claimedNodeIds: claimed.map(n => n.id), order: nodes.map(n => n.id), adaptPosition: false, detachSlotNodeIds: claimed.filter(n => n.originalSlotId && !n.slotId).map(n => n.id), depthNodeIds: claimed.filter(n => n.depth != null || n.nativeRequestedDepth != null).map(n => n.id), diagnostics }
  } })
  registry.register({ id: 'default', pluginId, name: ['来源默认顺序', 'Default source order'], execute: ({ remainingNodeIds }) => ({ claimedNodeIds: remainingNodeIds }) })
  return registry
}
