# Standard backend and advanced extension

[中文](BACKENDS.md) · [Installation](INSTALLATION_en.md) · [Source contract](INTEGRATION_en.md)

See [resource layout](RESOURCE_LAYOUT_en.md) for current blocks, slots, stable positioning and legacy compatibility.
`dsh-prompt-assembler` is the standard Host plugin and shared strategy, registry, parsing and assembly library. Tavern depends on it normally. `dsh-prompt-assembler-core` is a separately packed optional Host extension under this repository's `core-extension/`; it explicitly registers the validated protocol-1 executor. The standard bundle does not register `agent/assemble-request` or modify DSH core. Memory Manager remains optional.

| Capability | Standard `backend:native` | Advanced `backend:core` |
| --- | --- | --- |
| Host | Public section/context/pre-step interfaces on stock DSH 0.2.0-rc.2 | Explicit core addon plus prepared protocol-1 core |
| Official instructions | Keep, disable or reorder the current system-section block | Existing complete-system projection contract |
| Preset/persona/character/lore/PHI | System modules before history; user modules within delivery boundaries below | Existing ST markers, roles, depth and request/snapshot behavior |
| History/current input | Both required, history before input; internal messages retain order | Disable or move whole blocks; native order and tool transactions remain protected |
| Roles | Source-supported system/user; native blocks preserve roles | Source-supported preserve/system/user/assistant, subject to provider limits |
| Retention | DSH records system updates and user messages | Request-only bodies stay outside native history; retained snapshots use advanced anchors |
| Evidence | Native durable events; Tavern Trace system/context references and hashes | Log-only request/assembly stores the frozen request; Trace references that event |

Standard system text contributes to official assembly. DSH decides whether updates replace the request head or become in-history system updates according to model capability. Module-order strategies retain native updates unless official instructions are disabled; the adaptive modes below reconcile the effective system surface through public request-series decisions.

User `delivery:context` is a native snapshot after current input: changed text appends, unchanged text reuses the snapshot. `delivery:pre-step` accepts a user message at an actual step, before or after current input. After input, context always precedes pre-step; reversed layouts are rejected. Contributions within one delivery region can be reordered. **Both enter durable history.** Disabling/removing a source stops future contributions; old bodies remain historical. Context withdrawal uses DSH's invalidation message; pre-step does not retract earlier messages. Arbitrary depth, disabled history/input and post-history system contributions are refused with `ASSEMBLY_NATIVE_UNSUPPORTED`, without implicit conversion in Module order.

Tavern supplies distinct reference configurations that can be saved as custom strategies:

| Built-in strategy | Effect |
| --- | --- |
| Preset slots first (standard) `builtin-native-slots` | RP default. Place referenced content at preset slots, adapting identity to native history/input boundaries; fall back to roles when slots are absent. |
| Roles first (standard) `builtin-native-roles` | Preserve preset and lore entry roles. Within legal delivery regions, use preset slots, entry order, then module order. |
| Lore and PHI last (standard) `builtin-native-cache` | Prefix assets become system contributions; append lore as user context after input, then PHI as user pre-step. |
| PHI last (standard) `builtin-native-phi` | Keep lore and other assets as system contributions before history; append only PHI as final user pre-step. |
| Preset slots first (advanced) `builtin-st` | Preserve supported preset slots, authored roles and message-level depth. Requires the core addon and compatible model capabilities. |
| Lore and PHI last (advanced) `builtin-cache` | Module-order reference: prefix assets → history → input → current lore → PHI, preserving source roles with request-only bodies. |

Slot templates use explicit resource-position priority: preset slots → user positions → resource positions → fallback order. Tail templates retain fixed module rules; they deliberately override the relevant module positions and do not promise to follow every preset slot. Cache hits and reminder effectiveness depend on the model/provider. Cache friendly has been renamed to describe actual placement. Native ST style was withdrawn because forcing assets to system is not ST ordering. Append snapshots duplicated the tail ordering and was withdrawn; advanced retention remains configurable in source rules.

New RP sessions and Apply default strategy use standard slots even with the advanced addon installed. Existing built-in snapshots, custom strategies and explicit opt-outs remain unchanged; select and apply a template again to adopt its new definition. Standalone DSH sessions have no implicit RP strategy.

A legacy strategy without `backend` remains core, retaining existing rule and revision semantics. Migration neither converts strategies nor removes applied snapshots. Missing core support returns 409 `REQUEST_ASSEMBLY_CORE_REQUIRED`; explicitly choose a standard preset or install the addon. Saving does not apply; applying captures a session snapshot. Both backends share one store, registry and UI.

`runtime.capabilities()` separates native, core, coreExtensionInstalled, nativeRoles, nativeUserDelivery and nativeUserEntersHistory. `runtime.requireAvailable(preset)` checks the specified strategy. Legacy `available()` means any backend is available, not core authorization. A protocol marker alone does not enable advanced execution. Addon removal revokes its backend while preserving selections and storage.

When native-system is disabled or omitted and retained effective system text differs from current assembly, public `startsRequestSeries` reconciliation asks DSH to update the effective system surface, preventing earlier in-history instructions from leaking into future requests. Original log events remain. The retained legacy native ST-style snapshot overrides authored roles and does not honor preset chat slots. User-only tails can use pre-step, but user contributions before existing history cannot be recreated with public append delivery; tail roles alone do not establish full advanced ST equivalence. Module placement is logical assembly policy; frozen DSH messages establish actual order.

## Preset-first ordering modes

Select a mode under Standard → Placement, or choose its matching built-in strategy. Existing sessions do not switch automatically.

| Mode | Ordering | Roles and delivery |
| --- | --- | --- |
| Preset roles first `native-roles` | Collect system content before history and user content after existing history, preserving expanded order within each region. | Preset text keeps preset entry roles; worldbook entries keep their own roles rather than a referencing slot or module override. Within each delivery region, preset slots take precedence over within-module entry order, then module order. User defaults to context; pre-step is selectable. Context follows input; pre-step may precede or follow it. |
| Preset slots first `native-slots` | Detect enabled preset `chatHistory`, `history`, `input` markers and `{{chatHistory}}`, `{{history}}`, `{{input}}` macros; arrange preset text and its references around those boundaries. | For preset-controlled content, a history slot converts its prefix to system and its suffix to user. An input-only slot preserves prefix roles and converts its suffix to user. These user contributions use pre-step. Independent content retains its role and delivery. |

For example, `Opening{{history}}Middle{{input}}Closing` becomes `system Opening → native history → user Middle → current input → user Closing`. `chatHistory` references both history and input. Missing history/input references fall back to roles-first ordering; a single reference keeps the other native block at a legal fallback position. Repeated references expand once. Explicit input-before-history order is rejected. Blank sessions retain preview boundaries without fabricating native messages.

The editor resolves ownership from current resources: preset text and its referenced fields have locked positions; unreferenced content is independently movable; mixed modules move only their independent remainder. For example, `worldInfoBefore` owns only the before worldbook group. The after group remains independent unless also referenced. Character/persona ownership is resolved per field; additional PHI text remains independent. Modules without current output are marked empty.

The resource-position page arranges stable resource categories by dragging. Sorting strategies process remaining resources in priority order; later passes cannot reorder resources already placed. The read-only result page explains native-history retention. See [resource layout](RESOURCE_LAYOUT_en.md) for native history, role, delivery and snapshot-reuse constraints. Legacy list strategies retain their original interpretation without automatic migration.

Slot-first ordering explicitly adapts roles of preset-controlled content: preview identifies each role or delivery adjustment without editing source presets. Roles first rejects assistant contributions that cannot be delivered natively; slots first can adapt slot-controlled assistant entries to system/user. Both reject explicit rule depth, preserve internal native order and tool transactions, and use public `startsRequestSeries` reconciliation to keep effective system content before history while retaining original events. Frozen requests are not rewritten. Preview shows the current assembly plan; unchanged native context snapshots can be reused at an earlier position, so recorded requests establish final placement. Existing Module order retains its strict boundaries.

Before/after character entries follow `worldInfoBefore`/`worldInfoAfter`; example positions surround `dialogueExamples`; author-note positions surround an enabled `authorNote` or `authorsNote` entry (marker or text). Both priority modes use these anchors. Roles first then groups by entry role; slots first adapts roles to position. A missing/disabled example or author-note anchor retains the previous before/after fallback and emits `WORLD_BOOK_SLOT_MISSING` rather than claiming exact placement.

`at_depth` remains separate from those slots. Standard slots first currently maps **0 after native history and 1 before native history**, adapting them to user pre-step and system respectively. Preview reports each mapping, and moving the worldbook module cannot move these boundary-bound entries. Original depth values are preserved. Values greater than 1 retain role/delivery approximation with a warning; they are not collapsed to 1. Roles first preserves entry roles and reports approximate depth. Module ordering continues to use module position and role overrides.

ST allows chat depths 0, 1, 2… counted from the end of chat. Standard 0/1 here is a boundary approximation, not ST message-level insertion. In advanced ST mode, positive depth counts backward from native non-system messages, including current input, tools and previously retained injections; zero means the end of the assembled request. Insertion must preserve tool transactions. This is not identical to ST’s chat-message depth inside Chat History, especially with tools/injections or modules following the chat slot.

Standard pre-step messages carry the dedicated `source.kind: dsh-prompt-assembler`, retaining their user role, content and insertion order. Stock rc.2 Chat classifies them as injected context and excludes them from its main chat list; actual requests and durable history retain them. This producer marker does not change pre-step into native runtime-context snapshot delivery. It applies to future messages; older messages recorded with a human user source are not rewritten.


## Native runtime environment prompt controls

Rules expose `dsh.runtime-context` (master), `dsh.sandbox-policy`, and `dsh.approval-policy` in both backends. Strategies that omit these controls retain the previous behavior. The editor displays them enabled; editing and saving/applying creates explicit settings.

The master filters only the supported DSH context names `sandbox:policy`, `approval:policy`, and `subagent:delegation`. Child switches filter the first two independently, retaining their settings when the master is off. Unknown sections, third-party contexts, and assembler worldbook, preset or memory context contributions remain. Ownership is never inferred from the user role. Native history and current input remain unchanged.

These controls affect prompt text only. DSH still owns placement, role and snapshot reuse; sandbox execution limits and approval policy are unchanged. These are fixed controls, not draggable text modules. DSH retains its context framing whenever any context remains; there is no standalone framing-only switch. Changes apply to future assembly, without rewriting historical snapshots; DSH expresses updates through a new snapshot or withdrawal notice. Preview lists currently present native sections and their included/disabled status. Actual-request views retain the recorded history.
