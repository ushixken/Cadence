# R6 — Named and pattern Hatch

R6 extends the native v3 `hatch` record without introducing another record type. A Hatch persists semantic boundary loops and either `{ kind: "solid" }` or `{ kind: "named", name, angle, scale, origin }`. Generated strokes are transient derived geometry and never enter persistence, selection topology, measurements, snaps, or tracking.

## Pattern authority

`CaderactHatchPatterns` is the pure registry and generation authority. The initial library is `ANSI31`, `ANSI32`, `ANSI33`, `GRID`, and `CROSS`. Definitions contain at most 16 canonical line families. Each family defines a direction angle, perpendicular model-space spacing, and an optional alternating dash/gap sequence with phase.

Canonical pattern coordinates are transformed in this order: select the named definition, multiply spacing/dash coordinates by the positive Hatch scale, rotate by the canonical Hatch angle, then translate by the model-space Hatch origin. Zoom, pan, and DPR only project the resulting segments and never affect their model-space generation.

## Finite generation and semantic clipping

For each transformed family, semantic Hatch bounds are projected onto the family normal. The generator derives a finite inclusive integer line-index range before allocating candidate lines. Each bounded candidate intersects the original Line, Arc, Circle, and Ellipse boundary descriptors through the shared curve-intersection authority. Parameters are tolerance-deduplicated and sorted; interval midpoints are classified by `CaderactRegionGeometry`, so holes, islands, deeper nesting, and disjoint components retain parity semantics. Tangent contacts do not create zero-length intervals.

Dash/gap expansion occurs after semantic clipping but uses the candidate line's canonical model-space parameter, preserving phase across disconnected clipped spans. Scale changes spacing and dash lengths together.

Hard limits are 16 families, 100,000 candidate lines, 1,000,000 total intersections, 20,000 intersections on one line, 200,000 dash fragments, and 100,000 final segments. Failure returns a structured `valid: false` result before unbounded work or publication.

## Editing and transforms

Hatch command options retain R5 Select/Point acquisition and add Solid/Pattern, built-in name, angle, and scale controls. Named defaults are ANSI31, angle 0, scale 1, and origin `(0,0)`. Properties exposes type, name, angle, scale, and numeric origin; multi-record common values are supported where the panel architecture permits. Changes validate and publish through one atomic replacement transaction.

- Move translates boundary and origin.
- Rotate rotates boundary/origin and adds the rotation to pattern angle.
- Uniform Scale scales boundary/origin and multiplies pattern scale.
- Mirror transforms boundary/origin and derives a canonical angle from the mirrored direction vector.
- Copy retains semantic parameters while allocating fresh record and boundary feature identities.

Derived segments are always regenerated from semantic state.

## Scene, persistence, and exclusions

`ViewportScene` calls the shared model-space generator once per named Hatch per scene build, projects its segments, and places them in the existing renderer-neutral property line batches beneath interaction overlays. Canvas2D and WebGPU therefore consume identical screen-space segments and do no Hatch-pattern math. Solid Hatch continues through the R5 triangle batch unchanged.

The file format remains version 3 under the additive schema policy. Only pattern metadata is serialized. Selection/window/crossing and area/perimeter use semantic fill/boundaries, including pattern gaps. Native Hatch continues to emit no Osnap or Track candidates. DXF HATCH remains explicitly unsupported and export rejects native Hatch atomically.

## R7 boundary

R7 may add associativity, custom pattern files, richer origin interaction, gradients/transparency, or DXF HATCH interoperability. None is part of R6; the ready integration points are the pure registry/generator, native pattern metadata, atomic Properties replacement path, and renderer-neutral projected line batches.
