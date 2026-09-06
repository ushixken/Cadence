# D7 — Arc

## Command and interaction

`Arc`, with alias `A`, is an explicitly repeatable finite drawing command. It accepts a start point, a second point, and an end point through the shared D1 point-input path. Pointer, absolute, relative, unit-aware, and mixed input therefore use the same command session. A valid third point publishes one native Arc and completes automatically; Enter or Escape before completion discards the transient draft.

## ArcDraftSession and geometry derivation

`ArcDraftSession` owns frozen P1/P2 values and the current resolved P3 candidate. P1 and P2 are visible Draft Point candidates through D2A. Pointer movement changes only P3 and derives a semantic preview; no draft value enters the document or history.

`ArcGeometry.fromThreePoints(P1, P2, P3)` is the single pure circumcircle derivation. It uses the two-vector cross product and closed-form circumcenter, then selects the signed start-to-end sweep whose angular interval contains P2. Positive sweep is counter-clockwise in world coordinates; negative sweep is clockwise. The start angle is normalized to `[0, 2π)`, while the signed sweep is canonical in `(-2π, 0) ∪ (0, 2π)`. This preserves minor or major arcs according to P2 rather than choosing the shortest path.

Input is invalid when points are non-finite or when `abs(cross) <= 1e-12 * max(pairwise distance²)`. This scale-relative policy rejects repeated, collinear, and numerically unstable near-collinear triples. Invalid P3 is not published, P1/P2 remain accepted, and the user can retry. Arc never silently degrades into Line.

## Persistent representation

The closed version-1 record union now includes:

```text
{
  id, type: "arc", layerId,
  center: { x, y }, radius,
  start: { x, y, featureId },
  end: { x, y, featureId },
  sweep
}
```

The start angle is derived uniquely from `center → start`, avoiding an equivalent redundant angular state. Validation requires a stable record ID, valid layer, finite center/endpoints, finite positive radius, unique stable endpoint feature IDs, a non-zero signed sweep shorter than one turn, both endpoints on the radius, and an end endpoint matching the rotated start plus sweep. Coordinate consistency uses a relative `1e-9 * max(1, radius)` validation tolerance solely for serialized floating-point reconstruction.

This is an additive member of the strict v1 record union, so document `formatVersion` and file `fileVersion` remain 1. Persistence emits the canonical fields above, round-trips identity and geometry exactly, and rejects missing, malformed, or unknown properties. P2 and all runtime state are deliberately excluded.

## Transactions, history, and layers

The record gateway allocates one Arc record ID and two endpoint feature IDs and captures the authoritative current layer. One valid P3 publishes through one existing `createAll` transaction, producing one revision and one history entry. Undo removes it and Redo restores the exact record. Publication failure rolls back atomically and retains P1/P2/P3 draft state for retry.

## Snapping and topology

All Arc inputs use D2A unchanged: committed Line/Arc Endpoints, committed Line Midpoints, enabled Grid, and accepted Arc P1/P2 Draft Points share one resolver and its existing ranking. Grid Snap OFF removes only Grid; Shift bypasses all modes and release reacquires normally.

Committed Arc start/end are genuine A10 endpoint features. Their feature references resolve against current authoritative state and participate in Endpoint snapping. D7 adds no Arc Midpoint, Center, Quadrant, Tangent, or Nearest candidates.

## Renderer contract

ViewportScene projects committed, preview, and selected Arcs into semantic screen-space `{center, radius, startAngle, sweep}` groups in the established draw order. World Y-up projection explicitly negates signed sweep for screen Y-down rendering.

Canvas2D uses its native `arc` path. WebGPU uses the generalized D6 curved tessellation utility. Arc subdivision is the corresponding fraction of the full-circle segment count, retaining the 0.25 CSS-pixel maximum sagitta target and deterministic 1–1,024 Arc segment bound. Tessellation remains rendering-only; document geometry stays exact.

## Selection and lifecycle

D3 Arc hit testing combines screen-space radial distance with the signed angular-span predicate. A near-circumference point hits only when it lies within the visible sweep; points on the unused portion of the source circle and points clearly inside/outside miss. Selected Arcs use the existing selected-geometry treatment and intentionally have no grips.

Pointer leave removes only the P3 preview and preserves accepted markers. Renderer recovery reconstructs preview from transient semantic state. New/Open retain their existing active-command blocking policy. Because Arc is registry-marked repeatable, U5A remembers canonical `Arc` after `Arc` or `A` activation and a later eligible Space tap launches a fresh ordinary session.

## Deferred work

D7 defers alternate Arc construction modes, tangent continuation, numeric radius/angle modes, ellipse arcs, Arc curve-midpoint/center/quadrant/tangent/nearest snaps, Arc grips, fillet, Ortho, Polar Tracking, dimensions, and UI restructuring.
