# D9 — Ellipse

## Command contract

`Ellipse` (`EL`) is repeatable and uses three point inputs: first full-axis endpoint, second full-axis endpoint, then a point defining the perpendicular second-axis distance. It uses the shared D1 input path, D2A resolver, and U5 Enter/quick-Space submission path.

## Geometry and draft

`EllipseGeometry.fromAxisEndpoints(P1, P2, P3)` is the sole derivation boundary. The center is `(P1 + P2) / 2`, `majorAxis` is `(P2 - P1) / 2`, and `minorRadius` is the absolute perpendicular distance from P3 to the P1–P2 line. The immutable `EllipseDraftSession` owns accepted P1/P2, moving P3, derived preview, and publication retry state. Degenerate first axes, zero perpendicular distance, and non-finite results are rejected without document publication. Equal radii remain a native Ellipse.

## Persistent representation

Strict version 1 adds one closed record shape:

```js
{ id, type: "ellipse", layerId, center: { x, y }, majorAxis: { x, y }, minorRadius }
```

The axis vector encodes orientation and first semi-axis magnitude without redundant angles or construction points. Both axis magnitudes must be finite and positive. Construction endpoints are not persistent topology and Ellipse exposes no Endpoint snap features. `fileVersion` and `formatVersion` remain 1.

## Rendering and selection

The viewport projects exact Ellipse geometry into a semantic screen-space overlay. Canvas2D uses its native ellipse path. WebGPU uses the shared bounded adaptive tessellator, recursively subdividing until midpoint-to-chord error is at most 0.25 CSS px, with finite depth and segment caps. This approximation is rendering-only.

Selection measures screen-space distance to the same adaptively tessellated visible curve, so zoom, rotation, and eccentricity do not turn the filled interior into a hit target. Selected Ellipses use the existing selected-curve style and have no grips in D9.

## Snapping, transactions, and lifecycle

P1/P2 are transient Draft Point candidates. Committed Line/Arc Endpoint, Line Midpoint, enabled Grid, Shift bypass, and ranking remain owned by D2A. A valid P3 publishes exactly one current-layer Ellipse in one transaction/history entry; Undo/Redo restores the exact record ID. Failed publication preserves the complete draft. Escape/finish, pointer leave, replacement, and renderer recovery clear or reconstruct transient visuals without persistent mutation.

## Deferred

Center mode, Ellipse Arc, center/quadrant/tangent/nearest snaps, construction topology, grips, Ortho, Polar Tracking, and dimensions are deferred.
