# Source integration contract (protocol 1)

[中文](INTEGRATION.md) · [Runnable example](examples/notes.js)

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

Implement `myNotesStore.read({sessionId,signal})` to return `{id,text}[]`. Registration does not apply a strategy or write history. `result.messages` contains logical contributions. Actual DSH requests also require `projectSystemSnapshots` and the official pre-freeze `agent/assemble-request` hook. Never replace durable history with logical assembly output.

## Sources and parsers

`register` requires `id/pluginId/name` and at least one of `resolve` or `parseText`. Optional fields include `version` (default 1), `stability`, `dependencies`, `multiple`, `roles`, `lifetimes`, `depth` and `generationRequiresPlugin`. `list()` returns JSON descriptors and `acceptsText`, without executable functions. Source identity is provider-declared, not a signature or permission boundary.

`resolve(context,rule)` supplies source content. Optional `parseText(context,rule)` interprets user-authored `rule.text`. `rule.inputMode:'text'` calls only `parseText`; the default calls `resolve`. A missing parser explicitly rejects text mode. Both return `{blocks,macros?,diagnostics?}` and share placement, role, depth and retention controls. The UI separates Add module from Add custom text with a source parser. Sources own their syntax: third-party text does not implicitly execute ST, EJS or JavaScript. Optional `renderText({text,context,variables,block,diagnostics,identity})` must synchronously return a string; the default preserves text. Rendering runs after declared source macro references expand.

A source implements `resolve(context,rule)`, `parseText(context,rule)`, or both. Parser-only registration or `supportsModule:false` keeps dispersed content out of the module picker while exposing its parser in Add custom text. Optional synchronous read-only `moduleAvailable({sessionId})` checks whether current independent content exists; it does not execute retrieval or grant permission. `list({sessionId})` exposes supportsModule, moduleAvailable and acceptsText. Multiple `inputMode:"text"` rules can share a parser without adding or restoring its content module; assembly still owns placement, roles, depth and retention.

Tavern stored templates appear as modules only when enabled supported resources are bound to the current session. Their text parser independently supports the read-only EJS subset, including `<%- await getpreset("fragment") %>`, `<%- await getchar("card-id") %>` and permission-checked getwi. It creates no stored template and grants no source access or writes. DSH native text and Tavern ST text are parser entries. Bound coherent MVU state/instructions and configured Manager retrieval remain independent modules when available; source-owned resources are excluded from Manager aggregation.

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

`role:'preserve'` retains the source role, defaulting to system. Users can override system/user/assistant; native modules only allow preserve/request. Depth 0 is the end; positive depth counts native non-system messages from the end and adjusts past a complete tool transaction. `request` re-evaluates each request. `snapshot` retains changed originals and history anchors. Disabled, removed or request-mode sources stop injecting previous snapshots; durable evidence remains readable.

## Built-in integrations and Host composition

- `createDshRegistry()` supplies native instructions, history, current input and `dsh.text`. Custom text uses native `{{variable_name}}` interpolation and rejects missing variables. It does not accept ST-specific macros. DSH continues to own Skill pre-step metadata, tool bodies and slash execution.
- `adapters/tavern` supplies source registration, `parseTavernText`, template/MVU registration and compatible presets. Tavern text and preset content share history/input/world-info parsing and ST macros. Source originals remain read-only; resource editing remains in Tavern.
- `adapters/memory-manager` exposes `connectMemoryManager(ctx,registry)` and follows the lifecycle of `dshMemoryManager`. `requestAssemblyResources()` provides detached configuration snapshots. Read-only trigger retrieval excludes source-owned MVU/world-book/template content to avoid duplicates. The observer records applied only after matching durable request/assembly, actual message hashes and source nodes. It does not prove network delivery.

Tavern composes the documented store, registry, runtime, HTTP and React primitives. `adapters/tavern-runtime` preserves its storage format, play/native defaults, owner metadata and historical APIs. The new service is `dshPromptSources`; Tavern retains `tavernRequestSources` and `pmp-dsh-tavern/request-assembler` compatibility forwarding. The legacy format string and message source labels remain wire-compatible. Removing a source does not convert history or copy assembled content into it.

Standalone Hosts use `RequestAssembler({ctx,store,resources,registry,sessionReads,owner})`. The read-only resource provider supplies `compile({agent,sessionId,resolveOnly:true})` and current `assembledFor(agent)` snapshots containing assemblyInput, officialAssembly and diagnostics, plus optional maxProfileBytes. Call execute after resource preparation and before request freezing. Wire session inheritance to store.copySelection. Preview uses current official systemPrompt and a detached Session. `createSessionReadContext` grants only a temporary read lease. Never mount two independent strategy hooks for the same request.

The HTTP factory handles JSON and rule primitives, not authentication. Mount `createAssemblyApi({store,runtime,agents,sessions,inspect,notify,root})` behind the caller's existing authentication. Embed `AssemblyPanel({sessionId,fetcher,apiRoot,locale,traceRoot?,refreshEvent,close})`; desktop callers must inject a secure fetch wrapper. The core capability remains `agentLoop.requestAssemblyVersion===1`.

## Contributor acceptance

```sh
node --test test/integration.test.mjs
npm pack
```

Test dynamic and custom parsing, success/failure, read-only preview, evaluation at every step, list/depth placement, disabling/removal, cancellation, provenance and version leases. Submit adapters to this repository, without importing source-package internals. Tavern/Manager integration tests establish their real Host and browser combination; fixtures do not establish real-provider or user-data acceptance.

Tavern preset/custom sources declare user-text parsing; characters, personas and world books use their resource editors and do not declare that input mode. The DSH adapter accepts an optional read-only section attribution callback through `registerDshSources(registry,{sectionPlugin})`. The Tavern adapter preserves its official section display ownership there; the generic DSH adapter does not guess Tavern identity.

Actual Host checks: `DSH_ASSEMBLER_CORE_ROOT=/path/to/prepared/runtime DSH_ASSEMBLER_MANAGER_ROOT=/path/to/dsh-memory-manager node --test test/host.test.mjs`. They use temporary sessions and an offline synthetic provider, without real model calls.
