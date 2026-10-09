# Resource positions and assembly results

[中文](RESOURCE_LAYOUT.md) · [Usage](USAGE_en.md) · [Backend limits](BACKENDS_en.md)

The editor has two pages. Resource positions lists every potential content position declared by providers, with switches and drag handles. With a session or opening draft, background resolution updates categories with a definite single position; empty and split categories retain their configured positions with an explanation. Assembly result loads current assets and applies the selected sorting policy, showing emitted content, provenance, roles, order and decisions. Reading the latest recorded request is a separate read-only action; editing a draft cannot change that record.

## Configuration units

A position is a stable source category, not an activated entry. Presets expose main prompts, post-history instructions, depth injections and other text. Character description, personality, scenario, examples and persona show their corresponding macros/slots. Worldbooks expose before/after groups, positions around examples and author notes, and depth injections. Providers can declare further positions.

MVU declares its standalone variable-state and update-instruction injection. Variable references already embedded in worldbook/template text belong to that containing text; arbitrary variable values are not independent messages. Templates declare standalone and depth injections. Empty positions remain configurable, including registered providers with `moduleAvailable:false`; listing capabilities does not resolve their resources.

Source, parser, role, delivery, retention and native-context settings are under the configuration page's Source, text and delivery settings disclosure. The result page is read-only and does not present empty configuration rows as emitted output.

With the standard backend, Preserve source roles routes system content before history and user content into native user delivery regions. Slot priority orders content within role and runtime boundaries instead of forcing role changes across slots. World-book depth cannot override this identity choice. Only Allow position adaptation maps roles from slots and depth 0/1. The native-instructions switch is independent and can always be turned off.

Assembly errors remain visible until revalidation succeeds; editing or saving does not establish validity. Before applying the current or default strategy, the UI previews it again against the current session or opening draft and refuses application on failure. Checks exclude unsent input; actual requests still revalidate changing resources.

## Priority and switches

Dragging creates a custom position that always overrides automatic placement. Follow source position restores automatic placement. Only the dragged category becomes custom; other categories retain automatic rules. Internal entry order remains source-defined and original macro/slot references do not duplicate the detached content.

Built-in automatic priority contains `preset` (preset slots/macros), `resource` (resource anchors/depth), and `default` (source order). Higher rules win; each item uses its highest applicable rule. All six permutations are supported. Preset ownership retains reference placement, resource ownership uses relative anchors/depth, and default ownership uses source order.

Custom positions store stable source-category anchors, such as before `input/content`; `anchor:"end"` denotes the end. Overrides apply after automatic anchors settle, so custom positions follow anchors when automatic rules change. Anchors contain no activated entries or list indices. Manual dependencies resolve anchor-first; cycles reject assembly and missing targets follow the fallback policy.

With position adaptation enabled on the standard backend, priority resolves logical placement before roles and native delivery are projected. A custom-position category can follow history or current input. Moving it to the end places it after the remaining contributions even when later categories are empty, using user pre-step delivery. Preserved source roles still obey identity boundaries; incompatible moves report a runtime conflict.

Native history, tool transactions, retained snapshots and delivery regions are hard constraints, explained separately rather than pretending to be reorderable rules. Native system roles are not silently changed to simulate arbitrary ordering; identity adaptation is a separate choice. Inclusion switches do not compete in position priority: disabling a position excludes standalone and referenced content but never deletes durable history or retained snapshots. Native history/current-input anchors remain mandatory.

New strategies default to preset, resource, default. Reading legacy four-item lists removes `user` while retaining the relative order of the three automatic rules. Legacy `priority:user|preset` and layouts without a priority use those defaults. Existing manual positions now always override automatic placement. Reading does not rewrite stored files; saving uses the new representation. Older asset-specific `overrides` remain compatible, are excluded from automatic rules, and can be cleared. Position-adapted native layouts resolve semantic positions before identity projection and apply legacy overrides inside valid native regions.

## Protocol and persistence

Protocol-1 source descriptors optionally expose `positions` through the existing GET `sources` response; there is no new endpoint. Each entry is `{id, name:[Chinese,English], match?:{field?,group?,depth?}, anchor?:{sourceId,fields?,side}, macros?:string[], configurable?:boolean, note?:[Chinese,English]}`. Matching prefers a block's explicit `positionId`, then declared field/group/depth selectors, then an unmatched default. Providers without declarations have one `content` position. Macro labels explain existing relationships; they do not extend parser syntax. `anchor` declares resource-relative placement. Named worldbook outlets unsupported by the current loader remain visible but non-configurable, with an explicit no-output explanation.

Preset format version 1 remains unchanged. Optional layout fields include:

```json
{
  "version": 1,
  "source": "preset-slots",
  "identity": "preserve",
  "fallback": "source-order",
  "priority": ["preset", "resource", "default"],
  "overrides": [],
  "positions": [
    {"sourceId":"worldbook","positionId":"after","enabled":true,"placement":"list","anchor":{"sourceId":"worldbook","positionId":"before","side":"before"}},
    {"sourceId":"worldbook","positionId":"before","enabled":true,"placement":"source"}
  ]
}
```

Positions contain no resource IDs, entry IDs, state revisions or activation lists. Replacement assets and newly activated entries are evaluated afresh. `fallback` continues to select diagnosed fallback or assembly rejection; unknown providers/positions produce `POSITION_SOURCE_MISSING`. An empty known position keeps its configuration row; if explicitly selected as a custom anchor, missing-target behavior follows the fallback setting.

`positionRows(preset,sources)` returns the complete configuration list; `configurePosition` builds switch/order edits. `normalizeLayout`, `describeResourceLayout` and `withBlockMove` retain compatibility; the last is for asset-specific overrides. Result nodes include `positionId` and `positionDecision`; `resourceLayout.positionDecisions` summarizes switches and decisions, while `POSITION_CONFLICT` explains identity/runtime limits on custom placement. `resolvedPositionRows` projects definite positions into the editor without saving that resolved order or changing applied snapshots.

Preview and sending share resolution and ordering. Native previews exclude pending input and user-context contributions may reuse retained snapshots, so a current assembly result is not a complete network request; read a recorded actual request for frozen evidence. The UI cannot generate content from an unregistered plugin.

Validation: `node --test test/resource-positions.test.mjs test/plugin-client.test.mjs`. `test/resource-layout-host.test.mjs` uses `DSH_ASSEMBLER_STOCK_ROOT` / `DSH_ASSEMBLER_CORE_ROOT` and temporary profiles to check persisted policies, replacement assets, priority ordering and offline real requests. Browser acceptance covers empty categories, background position resolution, switches, dragging, priority changes, results, saving and applying.

Automatic rules determine ownership by priority, excluding custom positions. Result `sortingStages` lists custom positions and the nodes owned by each automatic rule; it describes ownership, not an editable execution pipeline. Resource cards explain declared stability before loading assets. Result cards explicitly distinguish existing native messages, native system/context/pre-step retention, request-only content, and separately retained assembly snapshots. Neither list has up/down buttons.

Third-party algorithms register independently and can be added, removed and reordered in the editor. The saved array executes sequentially; each algorithm claims only remaining whole nodes. The three built-in IDs remain required. Missing algorithms retain their IDs but block preview, apply and subsequent execution until reinstalled or removed. See the [strategy contract](DEVELOPER_GUIDE_en.md#register-ordering-strategies-and-preset-catalogs). Tests: `node --test test/strategies.test.mjs test/resource-positions.test.mjs test/plugin-client.test.mjs`.
