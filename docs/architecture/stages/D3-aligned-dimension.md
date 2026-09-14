# D3 — Aligned dimension command

## Command and workflow

`Aligned` (`DIMALIGNED`, `DAL`) is a repeatable three-point command. P1 and P2 define the measured direction; P3 selects the perpendicular dimension-line offset and may lie on either side. The third accepted point publishes one native, non-associative `dimension-linear` record with `mode: "aligned"`. Coincident definition points use the same document-scale rejection tolerance as D2 and leave the second-point phase retryable.

Every point phase uses the shared viewport authority: optional Ortho/Polar constraint, semantic object snap, object-snap tracking, Grid, then constrained/free fallback. This includes first-point acquisition. Typed P5 absolute, relative, polar, and unit-aware points enter the same session acceptance boundary. Dynamic Input, the snap marker, preview, and acceptance consume the final resolved candidate while the custom CAD cursor remains at the raw pointer.

## Measurement and presentation ownership

D3 adds no command-local dimension construction. The transient preview is a record-shaped aligned dimension and both preview and committed records pass through the D1 `DimensionGeometry.measure` and `DimensionGeometry.derive` authorities. Measurement is the Euclidean distance `hypot(P2.x-P1.x, P2.y-P1.y)`. D1 projects P3 onto the normal of P1→P2, producing a dimension line parallel to the measured direction and perpendicular extension lines. The same path supplies arrows, text, formatting, renderer-neutral primitives, Canvas2D/WebGPU rendering, and DOM annotation ownership.

P1/P2 ordering does not change the measured magnitude. Near-horizontal, near-vertical, reversed, very small finite, and either-side placements remain deterministic. Text override/editing, associative source references, collision avoidance, dimension snapping, selection, and grips remain outside D3.

## Publication and lifecycle

The existing dimension record factory assigns the current usable layer, ByLayer properties, stable record and definition-feature identities, and `textOverride: null`. Publication is one atomic document transaction and one history entry. A failed publication retains P1/P2 and the placement candidate can be retried. Undo/Redo and v2 persistence preserve the exact native record.

Escape cancels all phases without publication. Completion, replacement, document replacement, renderer recovery, pointer leave, and repeat use the established command/viewport lifecycle, clearing transient preview, snap/tracking feedback, and Dynamic Input without changing document state. Native dimensions remain deliberately outside object-snap candidate generation and selection/hit-testing.
