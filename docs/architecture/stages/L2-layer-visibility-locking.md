# L2 — Layer Visibility and Locking

## Shared authority

Layer `visible` and `locked` flags remain document-owned A7 state. The document
reader exposes two derived, immutable record projections: visible reference
geometry and visible-unlocked editable geometry. Renderer-neutral scene and
SnapResolver inputs consume the first; selection, grips, editable command
sources, and record mutation gateways consume the second. The Layers panel is
only a projection and action surface.

| Layer state | Render | Select/edit | Osnap/Track reference |
| --- | --- | --- | --- |
| visible, unlocked | Yes | Yes | Yes |
| visible, locked | Yes | No | Yes |
| hidden, unlocked | No | No | No |
| hidden, locked | No | No | No |

Visibility therefore dominates locking for viewport interaction. Locked
geometry is rendered normally in L2; faded locked styling is deferred.

## Current-layer safety

Hiding or locking the current layer is allowed only when another visible,
unlocked layer exists. The same transaction changes the flag and selects a
replacement: the Default layer when usable and not the target, otherwise the
first usable layer in stable document order. No layer is silently created. If
no replacement exists, the operation publishes nothing and reports that
another visible, unlocked layer is required. Explicit current-layer assignment
also rejects hidden or locked layers, and drawing factories defensively reject
an unusable current layer.

## Rendering, selection, and references

Hidden records are filtered before `ViewportScene`, so Canvas2D and WebGPU
receive identical visible geometry. Click selection, Window/Crossing, Select
All, command preselection, selection reconciliation, and grip ownership use the
editable projection. Changing a selected or grip-edited record's layer to
hidden/locked removes selection and safely cancels the grip through the shared
history reconciliation path.

SnapResolver receives visible records. Locked visible geometry therefore
continues to provide Endpoint, Midpoint, Center, Intersection, Vertex,
Quadrant, Nearest, Perpendicular, and Tangent candidates; hidden geometry cannot
contribute, including as either side of an Intersection. Grid remains layer
independent. Tracking candidates carry narrow source-record metadata. Hiding a
source removes its acquisition and dependent guides; locking it preserves the
reference.

## Command protection

Normal and transform selection excludes hidden and locked records. Move, Copy,
Rotate, Scale, Mirror, Delete, Offset, Trim/Extend targets, and grips therefore
cannot acquire them as editable sources. Record replacement/removal and
Trim/Extend publication additionally check the authoritative source layer, so
stale IDs cannot bypass the policy.

Trim and Extend distinguish references from targets: visible locked geometry
may be selected during their boundary/cutting-edge phase and may participate in
planning, but target hit testing and publication require visible-unlocked
geometry. Hidden boundaries and targets are ignored.

## Transactions and persistence

Each visibility or lock action is one normal document transaction, including
any current-layer replacement. It increments revision, dirties the document,
and creates one history entry. Undo/Redo restore exact flags and current-layer
identity, after which selection, grips, tracking, and rendering reconcile from
the restored state.

The existing v1 format already persists `visible` and `locked`; no version bump
is needed. Save/Open retain exact flags and geometry references. Strict v1
validation rejects a file whose current layer is hidden or locked rather than
silently migrating its current-layer identity, and continues rejecting all
malformed documents atomically.

## Deferred L3+

Layer colors, linetypes, lineweights, object property overrides/reassignment,
locked-object fading, isolation, filters, nesting, drag ordering, saved layer
states, and per-viewport visibility remain deferred.
