# Standard backend and advanced extension

[中文](BACKENDS.md) · [Installation](INSTALLATION_en.md) · [Source contract](INTEGRATION_en.md)

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

Standard system text contributes to official assembly. DSH decides whether updates replace the request head or become in-history system updates according to model capability. The standard backend does not move native updates.

User `delivery:context` is a native snapshot after current input: changed text appends, unchanged text reuses the snapshot. `delivery:pre-step` accepts a user message at an actual step, before or after current input. After input, context always precedes pre-step; reversed layouts are rejected. Contributions within one delivery region can be reordered. **Both enter durable history.** Disabling/removing a source stops future contributions; old bodies remain historical. Context withdrawal uses DSH's invalidation message; pre-step does not retract earlier messages. Arbitrary depth, disabled history/input and post-history system contributions are refused with `ASSEMBLY_NATIVE_UNSUPPORTED`, without conversion.

Tavern supplies `builtin-native-st` (system assets before history, approximate ST order), `builtin-native-cache` (changing lore as post-input context and PHI as a final pre-step), and `builtin-native-phi` (system assets with a final user PHI reminder). Cache hits and instruction influence depend on the model/provider; a final user reminder does not have final-system priority. Existing `builtin-st/cache/snapshots` remain advanced strategies.

A legacy strategy without `backend` remains core, retaining existing rule and revision semantics. Migration neither converts strategies nor removes applied snapshots. Missing core support returns 409 `REQUEST_ASSEMBLY_CORE_REQUIRED`; explicitly choose a standard preset or install the addon. Saving does not apply; applying captures a session snapshot. Both backends share one store, registry and UI.

`runtime.capabilities()` separates native, core, coreExtensionInstalled, nativeRoles, nativeUserDelivery and nativeUserEntersHistory. `runtime.requireAvailable(preset)` checks the specified strategy. Legacy `available()` means any backend is available, not core authorization. A protocol marker alone does not enable advanced execution. Addon removal revokes its backend while preserving selections and storage.

When native-system is disabled or omitted and retained effective system text differs from current assembly, public `startsRequestSeries` reconciliation asks DSH to update the effective system surface, preventing earlier in-history instructions from leaking into future requests. Original log events remain. Native ST-style modules override authored item roles and do not honor preset chat slots. User-only tails can use pre-step, but user contributions before existing history cannot be recreated with public append delivery; tail roles alone do not establish full advanced ST equivalence. Module placement is logical assembly policy; frozen DSH messages establish actual order.
