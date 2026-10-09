# Third-party source integration

[中文](DEVELOPER_GUIDE.md) · [Complete source contract](INTEGRATION_en.md) · [HTTP API](API_en.md) · [Architecture](ARCHITECTURE_en.md)

An adapter belongs in the assembler repository and calls the provider's public interface. The provider owns identity, body syntax, access control, revision checks and editing. The assembler owns source descriptors, user-selected placement, roles, lifetimes, system snapshot projection and request metadata. There is no production dependency on Tavern or Memory Manager.

## Register a Host source

The bundled [notes example](examples/notes.js) supports an independently selectable module and a `[[note-id]]` text parser. Its store implements read({sessionId,signal}) returning {id,text}[] after source authorization. In a trusted Cordis plugin:

```js
import { registerNotes } from './notes.js'
export function apply(ctx) {
  return ctx.inject(['dshPromptSources', 'myNotes'], scope => {
    const registry = scope.get('dshPromptSources')
    if (registry.version !== 1) throw new Error('Unsupported source protocol')
    scope.effect(() => registerNotes(registry, scope.get('myNotes')))
  })
}
```

`myNotes` is the integrating provider's service, not a builtin. Publish its read contract and install/enable its bundle. Optional scoped injection mounts when both services exist and disposes registration when either disappears. Return every disposer; do not register a second request hook. Duplicate source IDs reject. Registration only makes a source selectable; the user must explicitly add/apply a rule. New independent sessions have no implicit strategy.

A rule is `{id:'notes',kind:'example.notes',role:'system',lifetime:'request',depth:null}`. User text adds `inputMode:'text',text:'Read [[scene]]'`; this selects parseText without adding a resolver module. Parser-only providers can omit resolve. Synchronous `moduleAvailable({sessionId})` reads metadata only, never performs retrieval or grants access. Bilingual contentGuide fields explain bodies, origin, editability and actual editor. Do not advertise an editor or authority the source does not have.

## Correct resolution and failure behavior

Resolvers get detached, deeply frozen request context; keep reads and previews side-effect-free. Honor cancellation. Keep stable block IDs, declare every cross-source dependency, and return text/native/reference blocks. Native references preserve tool transactions. Source leases stay outside JSON and `validateResolved` synchronously rechecks them after all asynchronous sources. An absent registration emits ASSEMBLY_SOURCE_UNAVAILABLE and omits its contribution/snapshots; an invalid output or resolver/parser error rejects the request. A provider should distinguish intentionally empty results from unauthorized/failed reads. No silent raw-read fallback.

In advanced mode, `request` reevaluates every request; `snapshot` retains changed bodies at their original anchors while enabled. Unloading a source prevents later injection but keeps previously recorded DSH bodies readable. Logical `assembleRequestAsync` results require `projectSystemSnapshots` before DSH's request is frozen; library callers must not replace durable history with logical output. Host plugin users reuse the existing runtime instead of mounting another hook.

## API, store and embedding

Use dshPromptAssembler.store/runtime/registry through the Host service. Saving a preset changes the library; apply or applySnapshot binds an independent session snapshot. Child sessions inherit selection. migrateLegacy only merges missing IDs and preserves the old file. A unified session binding, including null, overrides old play/native scopes. UI and desktop integrations use the documented secure fetch, AssemblyPanel props and optional selectionTarget in [INTEGRATION](INTEGRATION_en.md).

Call runtime.requireAvailable(preset) before applying; capabilities() distinguishes native and optional core. Stock supports native strategies. Core requires the addon plus prepared protocol 1. Preview and observations do not prove provider delivery.

## Verify an integration

Run `npm run check` and a library smoke using the notes example, then test source failure, parser failure, concurrent read-only preview, each step, cancellation, disabled/unloaded source, role/depth, module availability and expired leases. Where a prepared Host is available, run the explicit external fixture commands in [installation](INSTALLATION_en.md#verification), using temporary sessions and a synthetic provider. Confirm one request/assembly per request and verify frozen messages against llm/stream. Browser acceptance separately checks source selection, saving versus applying, session changes and disposal. Submit adapter changes to this repository without importing private provider files.

For native placement and retention, see [backend rules](BACKENDS_en.md). Source descriptors advertise library capabilities; the selected backend may restrict them further.

## Register ordering strategies and preset catalogs

The ordering executor is a public registry independent of Tavern. `RequestSourceRegistry.strategies`, Host `dshPromptStrategies` and `dshPromptAssembler.strategies` share one instance. Its `version` is 1. `register({id,pluginId,name:[Chinese,English],execute})` returns an idempotent disposer and rejects duplicate IDs. Built-in `preset/resource/default` algorithms use the same contract. Library callers can supply `new RequestSourceRegistry({strategies})`; `createPositionStrategyRegistry()` includes built-ins, while an empty `new PositionStrategyRegistry()` allows explicit composition.

The [notes-last example](examples/notes-last.js) provides an independent algorithm. Bind its registration to the public Host service lifecycle:

```js
import { registerNotesLast } from './notes-last.js'
export function apply(ctx) {
  return ctx.inject(['dshPromptStrategies'], scope => {
    const strategies = scope.get('dshPromptStrategies')
    if (strategies.version !== 1) throw new Error('Unsupported strategy protocol')
    scope.effect(() => registerNotesLast(strategies))
  })
}
```

Registration does not edit existing presets. Add and order the algorithm in Resource positions, or save `layout.priority:['example.notes-last','preset','resource','default']` and explicitly apply it. The array retains all three unique built-in IDs and accepts namespaced IDs, with at most 128 items. Legacy `user` input is removed during normalization because manual positions always win. `default` consumes all remaining nodes, so algorithms placed after it receive no content.

`execute({nodes,remainingNodeIds,preset,logical})` is synchronous and read-only, with detached, deeply frozen input. Return `{claimedNodeIds,order?,adaptPosition?,detachSlotNodeIds?,depthNodeIds?,diagnostics?}`. Claims must be remaining nodes. An optional `order` must permute every node and preserve the relative order of unclaimed nodes. Later algorithms cannot claim already assigned nodes. `detachSlotNodeIds` only unlocks slots of claimed nodes; `depthNodeIds` only labels existing source depth and cannot change it. Callbacks cannot edit text, roles or messages, invent/drop nodes, or claim manual positions, native history, retained snapshots or depth boundaries. Embedded macro children remain part of their host node. Explicit `order` defaults to position adaptation when enabled by the layout; `adaptPosition:false` retains source role/delivery projection, as used by the built-in resource algorithm. Standard mode preserves delivery regions when preserving identity; native role adaptation requires explicit permission. Complete system projection and tool transaction checks still follow ordering.

Source and strategy registrations are captured at request start. Unloading during asynchronous resolution affects subsequent requests, not the captured execution. `resourceLayout.strategies/sortingStages` retain captured descriptors and each stage's claimed IDs. Missing algorithms fail with `409 POSITION_STRATEGY_UNAVAILABLE`; invalid output fails with `409 POSITION_STRATEGY_INVALID`. Missing algorithms never silently use the source fallback policy. Thrown errors or Promise callbacks also reject assembly. The editor retains unavailable IDs for removal or provider reinstallation; frozen results use captured names. After plugin hot loading, use the existing `dsh-prompt-assembler:refresh` event or reopen the panel to refresh catalogs.

`dshPromptAssembler.registerPresets({pluginId,presets})` and `store.registerPresets` provide independent catalogs without `attachTavern`. Each preset needs a stable ID under the existing letters/digits/underscore/hyphen contract (up to 200 characters); source and strategy IDs also allow namespace punctuation. Registration normalizes and clones the whole array, rejects global ID collisions and returns a disposer. Entries carry `builtin:true` and `pluginId`, and must be copied before editing. Unloading withdraws the catalog while retaining applied session snapshots and leaving default selection unchanged. Callers compose sources, algorithms, presets and their disposers without another request hook or HTTP endpoint.

## Third-party slots and implicit dependencies

Declaring `ownsSlots:true` allows a source's text and nested references to form the native slot spine without the special source ID `preset`. Reference blocks may declare `role:'system'|'user'|'assistant'`. Node `slotOwner` retains the real source ID, while `slotOwnerRuleId` distinguishes repeated rules from one source. Standard mode still requires history, current input and legal role order; this capability cannot bypass runtime boundaries. Legacy `preset` sources default to slot ownership, others do not; either can explicitly opt out.

An unlisted dependency's synthetic rule selects a legal role (preferring `preserve`) and lifetime (preferring `request`) from its descriptor. Explicit rules, including disabled rules, remain authoritative. Dependency permissions, resolution and snapshot retention follow the existing source contract.
