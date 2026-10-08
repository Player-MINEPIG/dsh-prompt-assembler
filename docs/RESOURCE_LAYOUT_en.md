# Assembly policy and current resource layout

[中文](RESOURCE_LAYOUT.md) · [Usage](USAGE_en.md) · [Backend capabilities](BACKENDS_en.md)

Sources (presets, character cards, worldbooks, memory) supply content; they are not drag units. An assembly block is one message or a contiguous group with a defined internal order. Slots specify positions and emit no text. Preset text, history, current input and worldbook position groups appear separately in the current layout. Dispersed output is never presented as one movable source.

Use “Policy and current resource layout” to choose layout source, identity handling and missing-target fallback. Source configuration retains toggles, text parsing, delivery and retention. Preview resolves current resources and shows each block’s entries, text, original/effective roles, resource/field provenance, internal order, slot binding, retention and runtime constraints. Content expanded into another body through a macro retains child provenance and cannot be dragged out independently.

A free block’s handle moves its entire contiguous output, preserving source-defined internal order. “More move options” contains the alternative keyboard controls. Dragging highlights the drop position and automatically refreshes current resources after dropping; changes still require saving and applying. Slot-bound blocks explain their lock; choosing a target under “Customize position” explicitly detaches them and enables subsequent dragging. Restore source position removes that override. History, depth-bound blocks and retained snapshots have runtime-managed positions.

## Composable policy

The preset format remains version 1, with optional `layout`. Existing save/export/API/session snapshots preserve this structure; no HTTP endpoint is added:

```json
{
  "version": 1,
  "source": "preset-slots",
  "identity": "preserve",
  "fallback": "source-order",
  "overrides": []
}
```

| Field | Behavior |
| --- | --- |
| `source: manual` | Default source order plus explicit block positions; preset references cannot relocate listed source bodies. |
| `source: preset-slots` | Preset references own slots; unreferenced output remains free. |
| `identity: preserve` | Preserve source-entry roles (authored custom text uses its configured role). Reject incompatible standard slot positions. |
| `identity: position` | Explicitly allow standard preset-slot/depth-boundary adaptation, recording original roles and adjustment diagnostics. This does not permit arbitrary placement across history. |
| `fallback: source-order` | Missing override targets keep source-default positions with diagnostics. Missing preset anchors retain diagnosed source fallback. |
| `fallback: error` | Reject missing override targets, requested references or diagnosed preset anchors. Empty slots alone are valid. |

Explicit `layout` derives `placement`. Legacy presets without `layout` retain their original placement, role overrides and delivery, with compatibility mode shown in preview. Adopting a resource layout policy changes only the draft; preview, save and apply explicitly. Applied snapshots are never silently migrated. Existing built-ins remain compatibility templates; new choices are independent constraints, not five mutually exclusive priority modes.

## Stable positioning and dynamic resources

Each override is `{target, anchor, side: "before"|"after", detach: boolean}`. Use `withBlockMove(preset, preview.resourceLayout, target, anchor, side, detach)` to construct it. Preview and execution share expansion, positioning and validation. Locator IDs are opaque: obtain them from a current preview rather than constructing them.

Worldbook locators use source rule, resource, position group, role, slot, depth and delivery region, never the current activated-entry list. New entries join their contiguous group next request and inactive entries leave. When other output splits one role/position into multiple runs, each run is addressed separately. Disappearing or merged runs cannot silently target another run: `LAYOUT_TARGET_MISSING` explains the fallback. Replacing a resource or slot structure may invalidate a locator. Repeated slots consume output once with `LAYOUT_DUPLICATE_SLOT`; empty slots remain visible.

`preview.resourceLayout` includes `policy`, `legacy`, `slots` and `blocks`. Blocks expose `nodeIds`, `entries`, `originalRoles/effectiveRoles`, `binding`, `region`, `reason`, `retention` and `limitations`. Entries include resource/field provenance, current text, macro children and position overrides. Slots carry `emitsText:false` and reference targets. This is the current assembly plan; historical actual requests still use the existing actual endpoint.

## Standard and advanced constraints

Standard assembly delivers system/user contributions and preserves native history order. System blocks cannot move after history. User pre-step blocks may move across current input within legal regions. Context uses the new-snapshot region but may reuse an earlier history position, explicitly labeled `NATIVE_CONTEXT_REUSES_HISTORY_POSITION`. Logical preview is not proof of the exact final frozen request position.

Standard depths 0/1 remain history-boundary mappings; greater depths retain approximation diagnostics. A preserve-role policy rejects conflicting boundary adaptation and never claims exact ST depth. Assistant sources can adapt only with explicit permission at supported slot positions. Advanced core retains existing role, depth and complete-tool-transaction validation; system updates also depend on model capabilities. Layout does not change history filtering, automatically reorder for caching, or sacrifice selected constraints for cache hits.

Run `node --test test/resource-layout*.test.mjs`. Real Host tests use `DSH_ASSEMBLER_STOCK_ROOT` and `DSH_ASSEMBLER_CORE_ROOT` for the corresponding dependency environments, temporary profiles and offline providers without paid model requests. In a browser, drag a free two-entry worldbook group, save/apply, activate a third entry, then compare preview with the offline actual request.
