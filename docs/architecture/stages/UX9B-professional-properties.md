# UX9B — Professional Properties

## Ownership

The right-sidebar Properties inspector is a selection-driven view over the active `CaderactDocumentSession`. It does not own geometry, selection, layer, block, or history state. Selection comes from `SelectionManager`; records and layer/block metadata come from the model reader; mutations use the existing record, layer, dimension-style, and geometry-transform authorities.

## Selection contract

- No selection shows a compact empty state.
- Homogeneous and heterogeneous multi-selection expose only safe shared General and Appearance properties. Mixed values are explicit and never replaced by an arbitrary member value.
- A single selection adds semantic geometry or transform fields appropriate to its native record type.
- Group selection continues to operate on the SelectionManager-expanded member record IDs in one transaction.
- A Block Instance exposes only instance insertion, rotation, uniform scale, and reflection. Block Definition contents are not edited through Properties.
- Locked, hidden, or command-owned selections are read-only.

## Editing and history

Layer assignment, ByLayer/explicit appearance, dimensions, annotations, hatch patterns, native geometry, and Block Instance transforms all pass through existing document-session gateways. Geometry movement and uniform radius changes use `CaderactGeometryTransform` so persistent record and feature identities remain stable. Every accepted field change publishes one history entry; invalid values publish none. Undo and Redo restore exact records.

Calculated values such as length, diameter, sweep, arc length, area, perimeter, and vertex count are read-only and recomputed from the authoritative record after every document/history change.

## Lifecycle and accessibility

The inspector refreshes from selection, command, history, and document-replacement subscriptions. Native labeled inputs and selects retain keyboard behavior and visible focus treatment. The compact two-column layout scrolls inside the existing sidebar and does not resize the viewport.
