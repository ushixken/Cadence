# D4 — Angular dimension command

## Command and workflow

`Angular` (`DIMANGULAR`, `DAN`) is repeatable. It accepts a first ray point, the shared vertex, a second ray point, and a dimension-arc location. P4 publishes exactly one native, non-associative `dimension-angular` record containing those four feature-bearing points, `textOverride: null`, the current usable layer, and ByLayer properties.

Every phase uses the shared pointer authority: optional Ortho/Polar, direct semantic object snap, tracking and tracking intersections, Grid, then constrained/free fallback. P5 typed points enter the same acceptance boundary without a second snap pass. P6 shows ordinary point feedback and, during placement, the shared included-angle value and radial distance. The custom crosshair remains at the raw pointer; marker, preview, HUD, and click acceptance use the final resolved point.

## Included angle and degeneracy

The command delegates measurement to `CaderactMeasurement.measureIncludedAngle`, producing the smaller unsigned included angle from 0° through 180°. A ray point coincident with the vertex is rejected using the dimension draft's document-scale floating tolerance. Angles within `1e-12` radians of 0° are rejected as degenerate; angles within `1e-12` radians of 180° are rejected because their minor-sector arc placement is ambiguous. The relevant phase remains active and no record or history is produced.

## Pure angular presentation

`DimensionGeometry` owns angular presentation. It deterministically chooses the counter-clockwise minor span: if first-to-second CCW is at most 180°, that is the span; otherwise the equivalent second-to-first span is used. Reversing the ray order therefore preserves magnitude and presentation. P4 supplies only the positive radius from the vertex. Its direction does not select a major arc; a point outside the minor sector is radially mapped to the same deterministic minor span.

The pure result contains two extension/ray segments, one native renderer-neutral arc, two closed-filled arrow triangles, a formatted text descriptor, bounds, hit primitives, and four semantic grip descriptors. Arrow tips lie at the arc ends and their bodies follow the inward arc tangents. Text sits at the angular midpoint at `radius + textGap`; its tangent rotation is normalized to a readable half-plane. Formatting uses the document dimension style, including `angularPrecision`, prefix/suffix, and text override.

## Scene, publication, and lifecycle

Preview and committed records use the identical measurement → formatter → `DimensionGeometry.derive` path. `ViewportScene` projects the resulting lines, arc, arrow triangles, and annotation once; Canvas2D and WebGPU consume the same arc/draw-group contract and contain no angular-dimension math. Zoom, pan, resize, DPR, hidden-layer behavior, renderer recovery, and annotation ownership therefore remain generic.

Publication is one atomic transaction and one history entry. Failure preserves all three definition points for placement retry. Undo/Redo and v2 persistence restore the exact record and feature IDs. Escape, completion, replacement, and document replacement clear transient preview, Dynamic Input, snap/tracking feedback, and annotation state. Committed dimensions remain excluded from selection and object-snap candidate generation.

## D5+ boundary

D4 does not add radius/diameter commands, selected-object angular workflows, associativity, dimension selection, interactive grips, Properties UI, text editing, collision avoidance, named styles, leaders, tolerances/GD&T, or interchange support.
