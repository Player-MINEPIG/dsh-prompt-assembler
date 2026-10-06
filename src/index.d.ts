export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type Role = 'preserve' | 'system' | 'user' | 'assistant'
export type Lifetime = 'request' | 'snapshot'
export type Stability = 'asset' | 'conversation' | 'evaluation' | 'assembly' | 'snapshot'
export interface Rule { id: string; kind: string; enabled: boolean; role: Role; lifetime: Lifetime; depth: number | null; text: string; name: string; inputMode?: 'source' | 'text' }
export type RuleInput = Pick<Rule, 'id' | 'kind'> & Partial<Omit<Rule, 'id' | 'kind'>>
export interface Preset { format: 'dsh-tavern-request-assembly'; version: 1; name: string; placement: 'st' | 'modules'; rules: Rule[]; id?: string }
export type PresetInput = Omit<Preset, 'rules' | 'placement'> & { placement?: Preset['placement']; rules: RuleInput[] }
export interface NativeMessage { id: string; role: string; content: Array<{ type: string; [key: string]: unknown }>; source?: { kind?: string; [key: string]: unknown }; [key: string]: unknown }
/** Detached and deeply frozen at runtime. Resolvers must be read-only in both modes. */
export interface SourceContext {
  readonly sessionId: string; readonly turn: number | null; readonly step: number | null;
  readonly preview: boolean; readonly signal?: AbortSignal;
  readonly preset: Readonly<Preset>; readonly assets: Readonly<Record<string, unknown>>;
  readonly nativeMessages: readonly NativeMessage[]; readonly inputIds: readonly string[];
}
export interface Descriptor {
  id: string; pluginId: string; name: string; version: number; stability: Stability;
  dependencies: string[]; multiple: boolean; roles: Role[]; lifetimes: Lifetime[]; depth: boolean;
  generationRequiresPlugin: boolean; recordedContentSurvivesRemoval: true; acceptsText: boolean; supportsModule: boolean; moduleAvailable: boolean;
}
export interface BlockBase {
  id: string; name?: string; referenceOnly?: boolean; stability?: Stability;
  source?: { resourceId?: string; field?: string }; depth?: number; order?: number; group?: string;
  children?: Json[];
}
export interface TextBlock extends BlockBase {
  type: 'text'; text: string; role?: Exclude<Role, 'preserve'>;
  /** Source-validated literal text inserted after ordinary macro expansion, without recursive evaluation. */
  literalMacros?: Record<string, string>;
  claims?: Array<{ sourceId: string; blockId: string }>;
  targetSourceId?: string;
}
export interface NativeBlock extends BlockBase { type: 'native'; messageIds: string[] }
export interface ReferenceBlock extends BlockBase {
  type: 'reference'; sourceId: string; blockIds?: string[];
  honorEnabled?: boolean; useOwnerRule?: boolean; lock?: boolean; owner?: string;
}
export interface SourceOutput { blocks: Array<TextBlock | NativeBlock | ReferenceBlock>; macros?: Record<string, string>; diagnostics?: Json[] }
export type SourceDefinition = Pick<Descriptor, 'id' | 'pluginId' | 'name'> & Partial<Omit<Descriptor, 'id' | 'pluginId' | 'name' | 'moduleAvailable'>> & {
  moduleAvailable?(context: { sessionId?: string }): boolean;
  resolve?(context: SourceContext, rule: Readonly<Rule>): SourceOutput | Promise<SourceOutput>;
  parseText?(context: SourceContext, rule: Readonly<Rule>): SourceOutput | Promise<SourceOutput>;
  renderText?(input: { text: string; context: SourceContext; variables: Map<string, string>; block: TextBlock; diagnostics: Json[]; identity: string }): string;
  /** Read-only synchronous lease check after all asynchronous sources have resolved. */
  validateResolved?(context: SourceContext): void;
}
export const ASSEMBLY_SERVICE: 'dshPromptSources'
export const SOURCE_PROTOCOL_VERSION: 1
export class RequestSourceRegistry {
  constructor(options?: { renderText?: SourceDefinition['renderText'] });
  readonly version: 1;
  register(source: SourceDefinition): () => void;
  list(context?: { sessionId?: string }): Descriptor[];
  resolve(context: SourceContext): Promise<unknown>;
  resolveSync(context: SourceContext): unknown;
}
export function createDshRegistry(): RequestSourceRegistry
export function registerDshSources(registry: RequestSourceRegistry, options?: { sectionPlugin?(section: Record<string, any>): string | null }): () => void
export function parseDshText(context: SourceContext, rule: Readonly<Rule>): SourceOutput
export interface AssemblyOptions {
  afterAssembly?(result: AssemblyResult, context: SourceContext): void;
  preset: PresetInput; registry?: RequestSourceRegistry; assets?: Record<string, unknown>;
  nativeMessages?: NativeMessage[]; inputIds?: string[]; previous?: AssemblyResult | null;
  snapshots?: unknown[]; maxBytes?: number; preview?: boolean;
  sessionId?: string; turn?: number; step?: number; signal?: AbortSignal;
}
export interface AssemblyResult { messages: NativeMessage[]; nodes: Array<Record<string, unknown>>; sources: Descriptor[]; snapshots: unknown[]; diagnostics: Json[]; [key: string]: unknown }
export function assembleRequest(options: AssemblyOptions): AssemblyResult
export function assembleRequestAsync(options: AssemblyOptions): Promise<AssemblyResult>
export function textOf(message: NativeMessage): string
export const FORMAT: 'dsh-tavern-request-assembly'
export const BUILTINS: readonly Preset[]
export function normalizePreset(value: unknown): Preset

export function moveRule(rules: Rule[], id: string, targetId: string): Rule[]
export class AssemblyPresetStore {
  constructor(root: string, options?: { mode?: () => string | null; builtins?: readonly Preset[]; defaultPresetId?: string });
  list(): Preset[]; get(id: string): Preset; save(value: PresetInput, id?: string): Preset; remove(id: string): void;
  selection(id: string): Preset | null; apply(sessionId: string, id: string | null): Preset | null; copySelection(from: string, to: string): void;
}
export class RequestAssembler {
  constructor(options: { ctx: { get(name: string): any }; store: any; resources: any; registry?: RequestSourceRegistry; sessionReads?: any; owner?: string; afterAssembly?: AssemblyOptions['afterAssembly'] });
  sources(sessionId?: string): Descriptor[]; available(): boolean; requireAvailable(): void; selected(id: string): Preset | null;
  execute(payload: any, next: () => Promise<any>): Promise<any>; preview(input: any): Promise<AssemblyResult>;
}
export function projectSystemSnapshots(logical: AssemblyResult, nativeMessages: NativeMessage[], maxBytes?: number, options?: { preview?: boolean; systemPromptUpdate?: string }): AssemblyResult
