import { RequestSourceRegistry, SourceContext, SourceOutput, Rule, Preset, SourceDefinition } from '../src/index.js'
export interface BuiltinSourceOptions { worldbookPolicy?(context: SourceContext, output: SourceOutput): SourceOutput | Promise<SourceOutput>; worldbookValidateResolved?(context: SourceContext): void }
export function registerBuiltinSources(registry: RequestSourceRegistry, options?: BuiltinSourceOptions): () => void
export function createDefaultRegistry(options?: BuiltinSourceOptions): RequestSourceRegistry
export function registerTavernSources(registry: RequestSourceRegistry, options?: BuiltinSourceOptions): () => void
export function parseTavernText(context: SourceContext, rule: Readonly<Rule>): SourceOutput
export const renderTavernText: NonNullable<SourceDefinition['renderText']>
export const BUILTINS: readonly Preset[]
export const DEFAULT_RULES: readonly Rule[]
export function registerTavernTemplateSource(registry: RequestSourceRegistry, service: { parseText?(context: SourceContext, rule: Readonly<Rule>): SourceOutput | Promise<SourceOutput>; hasModule?(scope: { sessionId?: string }): boolean; resolve(context: SourceContext): SourceOutput | Promise<SourceOutput>; validateResolved(context: SourceContext): void }): () => void
export function registerTavernMvuSource(registry: RequestSourceRegistry, service: { resolveRequest(context: SourceContext): SourceOutput | Promise<SourceOutput>; validateResolved(context: SourceContext): void }): () => void
export function diagnoseTavernAssembly(assembly: import('../src/index.js').AssemblyResult, context: SourceContext): void
