# Resource positions and assembly results

[中文](RESOURCE_LAYOUT.md) · [Usage](USAGE_en.md) · [Backend limits](BACKENDS_en.md)

The editor has two pages. Resource positions lists every potential content position declared by providers, with switches and drag handles; no asset preview is required. Assembly result loads current assets and applies the selected sorting policy, showing emitted content, provenance, roles, order and decisions. Reading the latest recorded request is a separate read-only action; editing a draft cannot change that record.

## Configuration units

A position is a stable source category, not an activated entry. Presets expose main prompts, post-history instructions, depth injections and other text. Character description, personality, scenario, examples and persona show their corresponding macros/slots. Worldbooks expose before/after groups, positions around examples and author notes, and depth injections. Providers can declare further positions.

MVU declares its standalone variable-state and update-instruction injection. Variable references already embedded in worldbook/template text belong to that containing text; arbitrary variable values are not independent messages. Templates declare standalone and depth injections. Empty positions remain configurable, including registered providers with `moduleAvailable:false`; listing capabilities does not resolve their resources.

Source, parser, role, delivery, retention and native-context settings are under the configuration page's Source, text and delivery settings disclosure. The result page is read-only and does not present empty configuration rows as emitted output.

With the standard backend, Preserve source roles routes system content before history and user content into native user delivery regions. Slot priority orders content within role and runtime boundaries instead of forcing role changes across slots. World-book depth cannot override this identity choice. Only Allow position adaptation maps roles from slots and depth 0/1. The native-instructions switch is independent and can always be turned off.

Assembly errors remain visible until revalidation succeeds; editing or saving does not establish validity. Before applying the current or default strategy, the UI previews it again against the current session or opening draft and refuses application on failure. Checks exclude unsent input; actual requests still revalidate changing resources.

## Priority and switches

Each position follows its source or uses user order. Moving a row marks only that position as user-ordered. Other positions continue following their preset/source; the list supplies neighboring semantic anchors, and empty positions emit no text.

Sorting priority is an ordered, draggable list. `user` (user position configuration), `preset` (preset slots/macros), `resource` (resource-defined anchors/depth) and `default` (source list order) appear exactly once. Assembly executes each strategy in list order and excludes already placed resources from subsequent passes; all 24 permutations can be saved.

When preset ownership wins, content stays at the reference. A winning user move emits the category independently without duplicate inline content. A winning resource rule applies its declared relative anchor or depth. Default precedence uses source list order. Missing anchors follow the selected fallback policy. Results show the priority list used and the resulting decisions.

Native history, tool transactions, retained snapshots and delivery regions are hard constraints, explained separately rather than pretending to be reorderable rules. Native system roles are not silently changed to simulate arbitrary ordering; identity adaptation is a separate choice. Inclusion switches do not compete in position priority: disabling a position excludes standalone and referenced content but never deletes durable history or retained snapshots. Native history/current-input anchors remain mandatory.

New strategies initially list user, preset, resource and default; users can freely reorder them. Existing policies are not silently rewritten. Legacy `priority:user|preset` and absent-priority `source` choices appear as equivalent initial lists. Reordering saves the full array. Older asset-specific `overrides` remain compatible with an explicit removal action; semantic ordering runs afterward, subject to runtime constraints.

## Protocol and persistence

Protocol-1 source descriptors optionally expose `positions` through the existing GET `sources` response; there is no new endpoint. Each entry is `{id, name:[Chinese,English], match?:{field?,group?,depth?}, anchor?:{sourceId,fields?,side}, macros?:string[], configurable?:boolean, note?:[Chinese,English]}`. Matching prefers a block's explicit `positionId`, then declared field/group/depth selectors, then an unmatched default. Providers without declarations have one `content` position. Macro labels explain existing relationships; they do not extend parser syntax. `anchor` declares resource-relative placement. Named worldbook outlets unsupported by the current loader remain visible but non-configurable, with an explicit no-output explanation.

Preset format version 1 remains unchanged. Optional layout fields include:

```json
{
  "version": 1,
  "source": "preset-slots",
  "identity": "preserve",
  "fallback": "source-order",
  "priority": ["user", "preset", "resource", "default"],
  "overrides": [],
  "positions": [
    {"sourceId":"worldbook","positionId":"after","enabled":true,"placement":"list"},
    {"sourceId":"worldbook","positionId":"before","enabled":true,"placement":"source"}
  ]
}
```

Positions contain no resource IDs, entry IDs, state revisions or activation lists. Replacement assets and newly activated entries are evaluated afresh. `fallback` continues to select diagnosed fallback or assembly rejection; unknown providers/positions produce `POSITION_SOURCE_MISSING`. A known position with no current content is not a missing target.

`positionRows(preset,sources)` returns the complete configuration list; `configurePosition` builds switch/order edits. `normalizeLayout`, `describeResourceLayout` and `withBlockMove` retain compatibility; the last is for asset-specific overrides. Result nodes include `positionId` and `positionDecision`; `resourceLayout.positionDecisions` summarizes switches and decisions, while `POSITION_CONFLICT` explains runtime/preset precedence.

Preview and sending share resolution and ordering. Native previews exclude pending input and user-context contributions may reuse retained snapshots, so a current assembly result is not a complete network request; read a recorded actual request for frozen evidence. The UI cannot generate content from an unregistered plugin.

Validation: `node --test test/resource-positions.test.mjs test/plugin-client.test.mjs`. `test/resource-layout-host.test.mjs` uses `DSH_ASSEMBLER_STOCK_ROOT` / `DSH_ASSEMBLER_CORE_ROOT` and temporary profiles to check persisted policies, replacement assets, priority ordering and offline real requests. Browser acceptance covers configuration without preview, switches, dragging, priority changes, results, saving and applying.

Sorting proceeds through the saved list one strategy at a time. Each pass consumes only unplaced resources; later passes cannot move resources consumed by an earlier pass. Result `sortingStages` records which nodes each pass placed. Resource cards explain declared stability before loading assets. Result cards explicitly distinguish existing native messages, native system/context/pre-step retention, request-only content, and separately retained assembly snapshots. Neither list has up/down buttons.
