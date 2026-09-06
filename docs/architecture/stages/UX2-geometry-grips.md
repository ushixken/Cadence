# UX2 — Geometry Grips / Control Points

## Ownership and identity

`GripManager` owns transient grip discovery, screen-space hit testing, hover/active state, drag preview, cancellation, and publication coordination. Line-specific discovery, preview construction, identity resolution, and replacement are isolated in its Line adapter. A Line exposes exactly its existing start and end topology identities. A grip reference is `{ recordId, featureId, kind: "endpoint", endpoint, point }`; it contains no array or renderer index and creates no new persistent identity.

Grips are derived only for selected authoritative Lines. Multi-selection therefore exposes two grips per selected Line, while one active grip edit is allowed at a time. Active commands suppress grip presentation and interaction.

## Projection and visuals

Grip centers are the exact result of projecting their endpoint world coordinate. Idle grips are 6 × 6 CSS-pixel square outlines; hover and active grips are 8 × 8. Their four sides are symmetric about one logical center and remain fixed in CSS pixels across zoom and DPR changes. The scene carries separate idle, hover, and active renderer-neutral line groups, so Canvas2D and WebGPU consume the same geometry.

Grip hit testing uses an 8 CSS-pixel radius before ordinary object selection. Nearest distance wins; exact overlaps follow stable record/feature ordering. Grips remain distinct from the raw UX1 cursor, D2 snap markers, and permanent document geometry.

## Edit lifecycle

Pressing a grip captures its original Line and starts transient state without a transaction. Pointer movement passes through the existing D2 resolver and current snap-mode configuration; the preview uses the resolved point, while the UX1 cursor remains at the raw pointer. The authoritative Line remains unchanged and the preview is emitted through the transient preview group.

The active endpoint's own snap candidate is excluded during its drag, preventing it from trapping the pointer at its original position. The opposite endpoint and other Endpoint/Midpoint/Grid candidates remain deterministic and available.

Pointer release replaces the current authoritative Line once through the record gateway. Record ID, layer ID, unaffected properties, and both endpoint feature IDs are preserved. This produces exactly one normal history entry and revision. Releasing at the current authoritative coordinate is a no-op. Escape, pointer cancellation or lost capture, pointer leave, document replacement, disappearance of the target, command activation, and renderer failure/recovery discard the preview and release capture without publication.

Undo and Redo therefore use A4 history normally. Deletion removes stale selection/grip derivations; Undo can restore geometry and its exact endpoint identities, but does not restore transient selection.

## Deferred work

UX2 adds no midpoint grips, object translation grip, multi-grip transform, numeric grip input, dimensions, constraints, Trim/Extend, Offset, rotation/scale gizmos, 3D controls, grip preferences, or persistent grip state.
