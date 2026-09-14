# L7 — Layers + Properties Integration Contract

## Final authority map

| Concern | Authority |
| --- | --- |
| Layer records, current layer, visibility, and locking | L1/L2 `CaderactDocument` layer gateway and reader |
| Object-to-layer assignment | L3 `recordGateway.assignLayer` |
| Nullable object appearance overrides and validation | L4 `CaderactObjectProperties` and `recordGateway.setProperties` |
| Effective ByLayer appearance | L4 `CaderactObjectProperties` |
| Renderer-neutral style batches | L5 `ViewportScene` |
| Selected record identities | `SelectionManager` through the viewport |
| Context menus | C2 shared controller and thin semantic adapters |
| Layers and Properties presentation | L1–L3 Layers panel and L6 Properties panel |

The panels do not maintain alternate layer, selection, property, validation, assignment, or effective-style stores.

## Interaction matrix

| Interaction | Document effect | Selection/current-layer effect | UI reconciliation |
| --- | --- | --- | --- |
| Set current layer | One layer transaction | Selection unchanged | Current indicator refreshes |
| Assign from Layers, Properties, or context menu | One L3 batch transaction | Current layer unchanged | Layer field and rendering refresh |
| Hide selected object's layer | One layer transaction | Hidden records are pruned from selection | Grips, Properties, Osnap, and Track reconcile |
| Lock selected object's layer | One layer transaction | Locked records are pruned from selection | Geometry remains visible and usable by Osnap/Track |
| Change color/linetype/lineweight | One L4 batch transaction | Selected IDs unchanged | Scene and Properties refresh immediately |
| Switch sidebar tab or open Properties | None | None | Stable-width presentation only |
| New/Open | Replacement lifecycle only | Selection and transient references clear | Both panels rebuild; context menu closes |

## ByLayer presentation

The editable value remains visibly **ByLayer** whenever the record stores `null`. A separate restrained readout communicates the currently inherited color, linetype, or lineweight. When selected ByLayer records resolve to different layer appearances, the inherited readout says **Mixed** instead of choosing one record arbitrarily. Explicit values remain distinguishable from inherited values.

## Lifecycle, focus, and capability

Properties listens to selection, active-command, active-document, and history changes. Layers uses the same document and selection boundaries. Context menus close when selection or document capability changes, as well as on command start, replacement, blur, or their existing dismissal paths, so enabled actions cannot become stale.

The sidebar uses native buttons, selects, and color input semantics. Tabs support click plus Left/Right/Home/End navigation with visible focus. Editable fields retain native keyboard ownership, including Select All, while canvas shortcuts remain viewport-owned. Active commands disable property and layer mutations and restore availability immediately after completion or cancellation.

## Rendering, history, and persistence

Canvas2D and WebGPU consume the same L5 resolved scene styles. Property edits, layer changes, Undo, and Redo trigger a fresh scene and panel projection; neighboring style batches do not share mutable renderer state. Layer and property operations retain exact transaction semantics. Save/Open round-trips the existing v1 layer IDs, flags, ownership, overrides, and current layer without a format bump. Sidebar state itself never creates history or dirties a drawing.

Properties aggregation performs one selected-record lookup pass plus the document authority's ID-based aggregate. Rendering remains the existing scene rebuild. No additional per-row document scan or cache was introduced.

## Deferred

Transparency, fills, materials, custom linetypes, Match Properties, nested layers, layer groups and filters, layer isolation, drag reorder, saved or per-viewport layer states, plot styles, print lineweight behavior, advanced geometry editing, and full UI V2 remain deferred.
