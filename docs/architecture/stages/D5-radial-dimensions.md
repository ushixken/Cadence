# D5 — Radius and diameter dimensions

## Commands and source acquisition

`DimRadius` (`DRA`, with case-insensitive `DIMRADIUS` resolving to the canonical name) and `DimDiameter` (`DDI`, likewise `DIMDIAMETER`) are repeatable. A single visible Circle or Arc preselection enters placement immediately. Multiple or unsupported preselection enters explicit object picking. Explicit picking uses the existing visible-record hit authority, accepts locked visible geometry as a read-only source, rejects Line/Polyline/Ellipse retryably, and cannot acquire hidden geometry.

The picker exposes its raw model coordinate, so D5 projects it with `CurveDescriptor` and `CurveParameter.nearestParameter`. Circle projection is exact; Arc projection is clamped to the stored finite sweep. Preselection has no pick coordinate: Circle falls back to its +X radius point and Arc to its stored start point. This policy is deterministic and independent of screen geometry.

## Non-associative snapshot and placement

Acquisition copies only center and circumference points into transient state. No source record/feature ID, dependency, or association is persisted. Once captured, the snapshot remains valid if the source is hidden, changed, or removed; normal document replacement still follows the shared command-cancellation lifecycle. The dimension therefore never updates when its source later changes.

Placement accepts one authoritative point and publishes immediately. It uses the normal constraint → semantic Osnap → tracking → Grid → constrained/free pipeline, P5 typed point syntax, P6 distance/angle feedback from the captured circumference point, and the P9 raw-cursor/final-marker separation. The record is created on the current usable layer with ByLayer properties, irrespective of the source layer.

## Measurement, formatting, and presentation

Both modes persist one native `dimension-radial` record with `centerPoint`, `dimensionPoint`, `leaderPoint`, stable feature IDs, and `textOverride: null`. Shared dimension measurement returns radius or twice radius. Shared formatting applies `R` or `Ø` before the style-formatted value, preserving document precision, units, prefix/suffix, and text override.

Pure `DimensionGeometry` owns lines, arrow triangles, text, bounds, hit primitives, and semantic grip descriptors. Radius presentation draws center-to-circumference and circumference-to-leader segments with one inward arrow at the circumference. Diameter presentation draws the full implied diameter through the center, plus its leader, with inward arrows at both circumference ends. For an Arc diameter the full underlying circle is intentionally represented even when the opposite tip is outside the finite Arc; this is the documented beta convention and avoids inventing a second schema or two radius records.

Text follows the leader's readable orientation and is offset by `textGap`. Very small radii remain finite and deterministic; advanced collision avoidance, outside-arrow fallback, and dogleg routing remain deferred.

## Scene, history, and D6 boundary

Preview and commit pass through the identical measurement → formatter → `DimensionGeometry.derive` → `ViewportScene` path. Canvas2D and WebGPU receive the same renderer-neutral line, triangle, and DOM annotation data. Zoom, pan, resize, DPR, hidden dimension layers, and renderer recovery remain generic.

Publication is one transaction/history entry and a failed publication retains the captured source snapshot. Undo/Redo and v2 persistence restore exact geometry, layer/properties, record ID, feature IDs, and override. Preview and cancel create no history. Committed dimensions remain excluded from snapping and selection.

D6+ retains dimension selection, interactive grips, Properties, associativity, dimension Osnaps, named styles, center marks, jogged radius, ordinate/baseline/continued dimensions, text editing, leaders as records, tolerances/GD&T, and interchange.
