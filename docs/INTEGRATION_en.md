# Source integration contract (protocol 1)

[中文](INTEGRATION.md) · [Installation](INSTALLATION_en.md) · [Runnable example](examples/notes.js)

## Minimal integration

```js
import { RequestSourceRegistry, assembleRequestAsync, FORMAT } from 'dsh-prompt-assembler'
import { registerNotes } from './notes.js' // the example supplied with this document
const registry = new RequestSourceRegistry()
const stop = registerNotes(registry, myNotesStore)
const preset = { format: FORMAT, version: 1, name: 'Notes', rules: [
  { id: 'notes', kind: 'example.notes', role: 'user', lifetime: 'request', depth: 0 },
] }
const result = await assembleRequestAsync({ registry, preset, nativeMessages, inputIds, sessionId })
stop()
```

Implement `myNotesStore.read({sessionId,signal})` to return `{id,text}[]`. Registration does not apply a strategy or write history. `result.messages` contains logical contributions. The standard Host uses the shared runtime’s official sections/context/pre-step integration rather than sending that array. Advanced complete request replacement requires `projectSystemSnapshots` and the explicitly prepared protocol 1 pre-freeze `agent/assemble-request` hook. Stock DSH `0.2.0-rc.2` lacks that hook; plugin installation does not modify core. Never replace durable history with logical assembly output.

## Sources and parsers

`register` requires `id/pluginId/name` and at least one of `resolve` or `parseText`. Optional fields include `version` (default 1), `stability`, `dependencies`, `multiple`, `roles`, `lifetimes`, `depth` and `generationRequiresPlugin`. `list()` returns JSON descriptors and `acceptsText`, without executable functions. Source identity is provider-declared, not a signature or permission boundary.

`resolve(context,rule)` supplies source content. Optional `parseText(context,rule)` interprets user-authored `rule.text`. `rule.inputMode:'text'` calls only `parseText`; the default calls `resolve`. A missing parser explicitly rejects text mode. Both return `{blocks,macros?,diagnostics?}` and share placement, role, depth and retention controls. The UI separates Add module from Add custom text with a source parser. Sources own their syntax: third-party text does not implicitly execute ST, EJS or JavaScript. Optional `renderText({text,context,variables,block,diagnostics,identity})` must synchronously return a string; the default preserves text. Rendering runs after declared source macro references expand.

A source implements `resolve(context,rule)`, `parseText(context,rule)`, or both. Parser-only registration or `supportsModule:false` keeps dispersed content out of the module picker while exposing its parser in Add custom text. Optional synchronous read-only `moduleAvailable({sessionId})` checks whether current independent content exists; it does not execute retrieval or grant permission. `list({sessionId})` exposes supportsModule, moduleAvailable and acceptsText. Multiple `inputMode:"text"` rules can share a parser without adding or restoring its content module; assembly still owns placement, roles, depth and retention.

Tavern stored templates appear as modules only when enabled supported resources are bound to the current session. The unified Tavern text parser independently supports the read-only EJS subset, including `<%- await getpreset("fragment") %>`, `<%- await getchar("card-id") %>` and permission-checked getwi. It creates no stored template and grants no source access or writes. DSH native text and unified Tavern text are the two built-in parser entries. Bound coherent MVU state/instructions and configured Manager retrieval remain independent modules when available; source-owned resources are excluded from Manager aggregation.

The built-in parser picker has DSH text and one unified `tavern.text` entry. Tavern processes authored restricted EJS first, then history/input/world-info references, then content and ST macros. Referenced text is never executed as EJS. Source permission/lease checks remain mandatory; EJS fails explicitly when the template runtime is absent. ST setvar/getvar share temporary request variables and can depend on order; these are distinct from durable MVU state.

Legacy preset/custom/template text rules remain executable. Their `textParserAliasFor` points to `tavern.text`, hiding duplicate picker entries. UI preview/export/explicit save normalize text rules, without writing stored rules when opened. Unified Tavern text uses request retention; existing custom snapshots are not migrated in the background, and newly saved text rebuilds each request.

A module descriptor may provide `contentGuide:{contains,origin,editable,editAt}`. Each field is a nonempty `[Chinese, English]` pair describing actual content fields, source location, editing support and a real editing path. State absent editors explicitly. The expanded module shows all four fields and a read-only preview instruction for actual text/resource IDs. Missing guides show explicit unknowns rather than inferred capabilities. Rules do not grant content-write permission.

The per-request context captures detached, deeply frozen `sessionId/turn/step/preview/preset/assets/nativeMessages/inputIds/signal`; Signal remains the original object. Resolution must be read-only. Previews may run concurrently, have null turn/step and exclude pending input. Respect cancellation, removal and source-owned version leases. Parser errors and invalid output reject the whole request. In-flight requests use their captured registrations. Optional synchronous `validateResolved(context)` checks leases after every asynchronous source has resolved.

`assets` is opaque JSON supplied by the caller's read-only resource provider. Tavern fields are not guaranteed. The DSH text parser reads `assets.nativeVariables`. The Tavern adapter reads its public asset snapshot. The Manager adapter calls the public resource snapshot, trigger and observation interfaces.

## Blocks and placement

| Block | Fields | Meaning |
| --- | --- | --- |
| text | id/text; optional role/depth/order/name/stability/source | A source contribution with provenance |
| native | id/messageIds | References current native messages, without rewriting text or splitting tool transactions |
| reference | id/sourceId; optional blockIds/group | References a source declared in dependencies |

Block IDs must be stable and unique within a rule. A text block may supply `literalMacros` to its renderer; the core does not interpret them. `macros` maps names to the source's text block IDs. Callers must declare dependencies; cycles and duplicate macro names reject. `referenceOnly` blocks are only emitted through references. Cross-source claims and targetSourceId also require dependencies. Returned rule/descriptor fields cannot spoof registered identity. Limits are 8 MiB/10,000 blocks per source, 128 strategy rules and 524,288 characters of rule text.

In module-list placement, explicitly listed output blocks own their list position and depth. References and inline macros cannot relocate or re-enable them. Unlisted dependencies appear at authored reference positions; unused registrations do not inject content. Reference-only fields can be consumed by their owner, such as character PHI. The Tavern adapter preserves ST slot/depth semantics, with ascending injection_order at equal depth. Native system boundaries and complete tool calls/results remain mandatory; invalid ordering rejects.

In advanced assembly, `role:'preserve'` retains the source role, defaulting to system. Users can override system/user/assistant; native modules only allow preserve/request. Depth 0 is the end; positive depth counts native non-system messages from the end and adjusts past a complete tool transaction. `request` re-evaluates each request. `snapshot` retains changed originals and history anchors. Disabled, removed or request-mode sources stop injecting previous snapshots; durable evidence remains readable.

## Built-in integrations and Host composition

- `createDshRegistry()` supplies native instructions, history, current input and `dsh.text`. Custom text uses native `{{variable_name}}` interpolation and rejects missing variables. It does not accept ST-specific macros. DSH continues to own Skill pre-step metadata, tool bodies and slash execution.
- `adapters/tavern` supplies source registration, `parseTavernText`, template/MVU registration and compatible presets. Tavern text and preset content share history/input/world-info parsing and ST macros. Source originals remain read-only; resource editing remains in Tavern.
- `adapters/memory-manager` exposes `connectMemoryManager(ctx,registry)` and follows the lifecycle of `dshMemoryManager`. `requestAssemblyResources()` provides detached configuration snapshots. Read-only trigger retrieval excludes source-owned MVU/world-book/template content to avoid duplicates. The observer matches frozen requests and source nodes: advanced uses durable request/assembly hashes; native uses complete system text, context sections or accepted pre-step message identities. It does not prove network delivery.

The standalone plugin composes its own store, registry, runtime, HTTP API and browser UI. Package `main` is `src/plugin.js`; `./plugin` exports the Host entry and `./client` exports the browser entry. Root exports remain library primitives. `dsh.bundle` points to `cordis.patch.yml`, and `dsh.client` points to committed `dist/client.js`. Shared registration uses `dshPromptSources`.

`dshPromptAssembler` exposes `{store,runtime,registry,attachTavern(options),migrateLegacy(root)}`. Its store uses Host `dshHomePath('dsh-prompt-assembler')` and filename `assembly-presets.json`. New standalone sessions have no implicit strategy or global default. Current-session assembly is available from the sidebar before the first message; the strategy library's “Create session with this strategy” binds before opening the session.

`attachTavern({resources,sessionReads,mode,builtins,defaultPresetId,afterAssembly})` receives source-owned public read resources, read leases and compatibility configuration, and returns a disposer. Tavern registers through `registerTavernSources` on the shared registry. Source registration/removal follows its scoped context and does not re-register native DSH sources. The assembler has no Tavern/Manager package dependencies or internal-file imports. Sources retain content, parser permissions and resource editing. Tavern requires the independently mounted assembler service and retains legacy service/HTTP forwarding to the same owned store and runtime; new integrations should use the assembler service and API. Do not install two independent strategy hooks on the same request.

`migrateLegacy(root)` validates legacy `assembly-presets.json` and merges only IDs absent from the current store. Current assembler entries win and the old file remains unchanged. Old `play:` / `native:` scopes survive. Standalone selection checks the raw session ID, then explicit `native:<id>` and `play:<id>` entries, including explicit null. Standalone sessions without Tavern or a legacy selection receive no implicit default. Until reapplied, a legacy selection follows the active Tavern mode. Applying through the independent plugin binds the raw Session ID, so reinstalling Tavern or switching views cannot restore an older mode choice. `adapters/tavern-runtime` continues to offer compatibility composition primitives.

Attached Tavern uses native ST style by default; an explicitly mounted addon can select its advanced default. Existing unified/legacy snapshots retain their backend. Standalone use has no implicit default.

Current request metadata uses owner `dsh-prompt-assembler`; historical reads still accept prior `pmp-dsh-tavern` snapshots. Removing a source or the plugin does not convert history; standard user contributions already persist, while advanced assembly bodies are not copied into native messages. Plugin removal retains strategy storage and DSH durable history.

Advanced library callers explicitly register `CoreRequestBackend`; standard Host integration reuses the plugin’s public interface hooks. Standalone Hosts use `RequestAssembler({ctx,store,resources,registry,sessionReads,owner})`. The read-only resource provider supplies `compile({agent,sessionId,resolveOnly:true})` and current `assembledFor(agent)` snapshots containing assemblyInput, officialAssembly and diagnostics, plus optional maxProfileBytes. Library callers invoke execute after DSH resource preparation and before request freezing. Wire session inheritance to store.copySelection. Preview uses current official systemPrompt and a detached Session. `createSessionReadContext` grants only a temporary read lease. Never mount two independent strategy hooks for the same request.

The standalone plugin mounts its API behind Host authentication, origin checks and applicable desktop-token checks, and uses secure fetch in its browser entry. The library HTTP factory handles JSON and rule primitives, not authentication. Mount `createAssemblyApi({store,runtime,agents,sessions,inspect,notify,root})` behind the caller's existing authentication. Embed `AssemblyPanel({sessionId,fetcher,apiRoot,locale,traceRoot?,refreshEvent,close})`; desktop callers must inject a secure fetch wrapper. Core capability requires both the mounted addon and `agentLoop.requestAssemblyVersion===1`; missing either refuses advanced application. Standard strategies use native capability. Explicitly prepare core using the tool described in [installation](INSTALLATION_en.md).

## Contributor acceptance

```sh
node --test test/integration.test.mjs
npm pack
```

Test dynamic and custom parsing, success/failure, read-only preview, evaluation at every step, list/depth placement, disabling/removal, cancellation, provenance and version leases. Submit adapters to this repository, without importing source-package internals. Tavern/Manager integration tests establish their real Host and browser combination; fixtures do not establish real-provider or user-data acceptance.

Tavern preset/custom/template sources retain legacy text parsing; the new UI uses tavern.text; characters, personas and world books use their resource editors and do not declare that input mode. The DSH adapter accepts an optional read-only section attribution callback through `registerDshSources(registry,{sectionPlugin})`. The Tavern adapter preserves its official section display ownership there; the generic DSH adapter does not guess Tavern identity.

Actual Host checks are listed separately in [installation](INSTALLATION_en.md#verification), with explicit `DSH_ASSEMBLER_CORE_ROOT` and optional `DSH_ASSEMBLER_MANAGER_ROOT` fixtures. Standard CI runs `npm ci` / `npm run check` without providing those runtimes; skipped tests do not establish Host or browser acceptance. Tests use temporary sessions and an offline synthetic provider, without real model calls.

`AssemblyPresetStore.applySnapshot(sessionId, presetOrNull)` validates and saves a detached strategy snapshot without writing the preset library. This supports callers that save plugin drafts before creating a real DSH Session. Pass `null` to disable assembly. As with `apply`, the saved Session snapshot controls request assembly independently of subsequent library edits.

Callers embedding `AssemblyPanel` may provide `selectionTarget: { id, editable, getSelection(), applyAssembly(presetIdOrNull) }` to asynchronously read and write their own opening configuration. `applyAssembly` returns `{ selection }`. Omit `sessionId`: the panel mounts by target identity, displays its saved snapshot, and uses the assembler’s strategy library. Apply/reset/disable delegate persistence to the caller; transfer the snapshot to a real Session with `applySnapshot` on first send. The target does not impersonate a DSH Session. Expanded previews and request traces remain available only with a real `sessionId`.

Host activation and legacy strategy migration follow [backend rules](BACKENDS_en.md). Treat statements about depth/snapshot/projection and protocol-1 execution above as advanced-library contracts. `nativeAssembly`/`nativePreStep` are the standard public-seam lifecycle; `execute` is delegated only after an addon explicitly calls `registerRequestBackend`. `requireAvailable(preset)` is the application check.
