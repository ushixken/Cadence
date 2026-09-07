# M4 — Scale

M4 adds positive, uniform 2D Scale as a repeatable Modify command (`Scale`, alias `SC`). It reuses the established preselection and postselection workflow: selected records proceed directly to base-point input, while an empty selection enters the shared selection phase and confirms with Enter or quick Space.

## Copy option

Scale exposes the transient U5B option `Copy=No/Yes`, defaulting to `No` for each Scale session. `No` performs the normal in-place identity-preserving Scale. `Yes` keeps originals untouched and creates scaled records through the established M2 fresh record/feature identity path, preserving layers and all native geometry properties. Copy previews retain the authoritative originals and add only the transient dominant scaled result. A successful Copy=Yes publication is one atomic history entry and selects only the new copies; Undo removes them and Redo restores the exact copy identities. Remembered/persistent Copy option preferences are deferred.

## Geometry and input contract

The three points are base `B`, reference `R`, and target `T`. The command derives one factor for the complete selection: `distance(B, T) / distance(B, R)`. Pointer, absolute, relative, and mixed D1 input all use the normal D2A resolver. Endpoint, Midpoint, Draft Point, and enabled Grid candidates retain their existing ranking and tolerance; Shift bypasses them. Selected source records are excluded during target acquisition, and neither preview geometry nor feedback markers enter snapping or selection.

`GeometryTransform.scalePoint` and `scaleRecord` own all scale math. Lines scale both endpoints; Circles scale center and radius; Arcs scale center/start/end/radius while preserving sweep; Ellipses scale their center around `B`, multiply the major-axis vector directly, and multiply minor radius; Polylines scale vertices while preserving order and closure. Record, layer, endpoint, and vertex identities remain unchanged.

## Preview and publication

After base acceptance a strong fixed anchor marker appears. Reference acceptance adds the secondary marker and `B → R` guide. During target acquisition, an active marker and `B → T` guide share the exact resolved candidate that drives the dominant scaled preview. The stationary authoritative source is rendered as a subdued ghost. These fixed-CSS-pixel, renderer-neutral scene groups are consumed equivalently by Canvas2D and WebGPU and never mutate the document.

Zero reference distance and zero scale are rejected for retry. Non-finite or invalid results are rejected. A factor within `1e-12` of one completes as a history-free no-op. A valid scale builds every replacement first and publishes them through one atomic transaction, producing one history entry while retaining selection. Undo and Redo restore exact geometry and identity.

Escape, command replacement, pointer cleanup, successful/no-op completion, and normal teardown clear transient feedback. A publication failure changes nothing and retains coherent retry feedback; renderer recovery rebuilds it from command state. Negative/mirrored scale, non-uniform scale, direct numeric factors, Reference options, grip scale, gizmos, and 3D variants are deferred.
