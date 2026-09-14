# ME1 — Measurement Foundation

## Read-only authority

`CaderactMeasurement.pointToPoint` is a DOM-free model-space authority. It returns immutable start/end coordinates, signed ΔX/ΔY, Euclidean distance, and normalized direction in radians and degrees. It never reads screen coordinates or document state. A coincident pair returns distance zero and `null` angles rather than NaN.

Angles follow the standard 2D CAD convention: +X is 0°, +Y is 90°, −X is 180°, and −Y is 270°, normalized to `[0, 360)`.

## Distance command

`Distance` (`DI`, `DIST`) is a repeatable two-point command session. Both points pass through the same Viewport pipeline as Line: optional Ortho/Polar, P3 direct semantic Osnap, P4/P8 tracking and guide/geometry intersections, Grid, then constrained/free fallback. Locked visible records remain references and hidden records are excluded by the shared visible-record reader. Typed P5 coordinates remain authoritative and are not re-snapped.

The session stores only ephemeral P1, the live resolved P2 candidate, and its final measurement result. It creates no records, layer/property changes, revision, dirty state, or Undo/Redo entry. Escape before or after P1 clears all preview state.

## Presentation boundaries

Numeric measurement math is separate from `CaderactMeasurement.format`, which reuses the document's existing `CaderactUnits.format` policy. ME1 therefore retains the current document length unit and three-decimal command-result convention without introducing another unit or precision system. The completed command history reports Distance, ΔX, ΔY, and Angle; exact P1/P2 coordinates remain in the numeric result and formatted model.

After P1, the existing P6 Dynamic Input path sees the session's authoritative reference and final pointer candidate, so it displays live Distance and Angle without another HUD controller. `ViewportScene` emits a restrained `measurementOverlay` containing projected endpoints, line and marker segments, plus numeric distance/angle metadata. Canvas2D and WebGPU consume it through the shared renderer-neutral line groups and contain no measurement math.

## Future stages

- ME2: object Length, Radius, Diameter, Arc length, and Polyline length.
- ME3: Area and Perimeter for supported closed geometry and feasible picked boundaries.
- ME4: three-point included Angle, point-to-object and cumulative distance, and optional non-document measurement history.
- ME5: measurement UI/menu integration, copy-result, formatting, accessibility, and final audit.

Persistent dimensions, annotations, leaders, fills, and dimension entities belong to separate later tracks.
