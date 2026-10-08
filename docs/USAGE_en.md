# Using assembly strategies

[中文](USAGE.md) · [Installation](INSTALLATION_en.md) · [Source integration](INTEGRATION_en.md)

## Backend selection

Choose Standard for public DSH interfaces, or Advanced for the optional addon and prepared core. Legacy strategies remain advanced. Standard history/input cannot be disabled or moved out of order; no arbitrary depth or assistant contributions. User context and pre-step both persist in history. Standard mode offers five Tavern presets: ST style, cache-friendly ordering, final PHI, preset roles first and preset slots first. See [backend rules](BACKENDS_en.md).

## Entry and interface

The sidebar Prompt assembly entry is always available, including before a session’s first message. Sections appear in this order: Strategy library → Assembly rules and preview → Session application → Interface settings, separated by headings and dividers. Language changes UI labels; it is not prompt content or session strategy configuration.

## Saving and applying

Create, import, export or select strategies in the library. Built-ins cannot be renamed or deleted; save modifications as a copy. User strategies are editable. Saving updates the library; applying captures the chosen configuration for the current session. Editing a library strategy does not silently update applied session snapshots. Reapply it to affect future requests.

Create a session with this strategy requires an explicit workspace choice unless exactly one workspace exists. The plugin creates and binds the session before opening it, so its first request can use the strategy. There is no global default. Unselected or disabled strategies use DSH default assembly. Missing core support refuses advanced application; standard strategies apply on stock core.

The standalone and embedded Tavern panels share one strategy library and one session binding, with no plugin priority. The last successful application determines the session snapshot. Editing a draft or saving a library strategy does not overwrite the applied snapshot. Both panels refresh their applied status while preserving their own unsaved drafts.

## Native modules and message roles

| Module | Request contribution |
| --- | --- |
| Native instructions | Current DSH system instructions and system sections from registered plugins; system role |
| Native history | Previous user messages, assistant replies and tool results, preserving roles |
| Current input | Input newly submitted for this request; excluded from read-only preview |

For advanced strategies, disabling a module excludes its contribution to future requests, without deleting durable history or silently restoring composer text. Ordinary continuous conversations enable all three. Enable native instructions and current input to omit prior history.

In advanced mode, custom text defaults to user role and can use system or assistant. Text alone does not determine its role. The current DeepSeek adapter places leading system content in a separate system field. Without conversation messages, the wire messages array is empty. A nonempty custom user message can supply input while Current input is disabled; native instructions or custom system text alone do not form a conversation request for that interface. Preview reports ASSEMBLY_SYSTEM_ONLY; completely empty assembly is refused with ASSEMBLY_EMPTY. Other providers define their own valid roles and conversation requirements.

## Modules, custom text and placement

The module menu lists only sources with current independent content. Expanded modules explain included content, origin, editing support and the editing location. Edit source bodies in their owning plugin; assembly rules control inclusion, placement, roles, depth and retention.

A source with dispersed content can expose a text parser without appearing as a module. Add custom text selects that parser. DSH text expands only DSH-supplied `{{variable}}` values and rejects missing variables. Installing Tavern adds one unified parser: restricted read-only EJS, content references, then ST macros. Third-party parsers own their syntax and do not implicitly execute other sources’ code.

Advanced strategies can drag whole modules and configure supported depth, roles and retention. Rebuild each request evaluates fresh content without accumulating copies. Retained snapshots save changed bodies and history anchors. Disabled or removed sources stop injecting old snapshots, while recorded bodies remain readable. Complete tool calls and results cannot be split.

## Preview and actual requests

Preview current configuration uses the editor draft, readable resources and durable history. It neither applies a strategy nor calls a model, and excludes unsent composer drafts. Random macros use a fixed sample. Uninitialized or damaged source state should return an explicit diagnostic.

In advanced mode, View latest actual request reads the latest durable request/assembly from DSH, containing the request frozen at execution time. Editing strategies or removing providers cannot change that record; the record does not prove provider delivery.

## Removing and reinstalling providers

The selectable catalog contains currently registered provider built-ins and saved user strategies. Tavern owns the ST compatible built-in; it is absent without Tavern. A session’s applied built-in snapshot survives with an unavailable-provider notice and never re-registers itself globally.

Reinstalling a provider restores its registrations. Existing selections, explicit disabled states and strategies reapplied independently take precedence over old configuration. Missing source modules report diagnostics and are omitted; saved user strategies remain and use the source again when it returns. Migration and removal do not rewrite native history.

Standard mode uses native durable events. Tavern Trace verifies historical system/context references; the standalone panel does not present current history as a complete frozen request record.

Tavern opening drafts can also preview their selected resources and draft variables with this button. Drafts have no native history yet; previews exclude pending input and neither create a Session nor call a model. Actual requests are available after sending.
