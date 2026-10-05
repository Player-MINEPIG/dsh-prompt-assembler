import type { RequestSourceRegistry } from '../src/index.js'
export const SOURCE_ID: 'memory-manager.resources'
export function connectMemoryManager(ctx: any, registry: RequestSourceRegistry): unknown
export function registerRequestSource(manager: any, registry: RequestSourceRegistry, usage: { trigger: (...args: any[]) => any }): () => void
export function observeTavernRequest(manager: any, session: any, options: any): void
