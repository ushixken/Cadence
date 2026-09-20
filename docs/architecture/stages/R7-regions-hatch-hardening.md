# R7 — Regions and Hatch beta hardening

## Verdict

The R1–R6 Region/Hatch track is beta-ready. Region and Hatch remain non-associative semantic snapshots: source geometry is never referenced after creation, and derived contours, triangles, and pattern segments never become document authority.

## Final authority chain

Semantic Line/Arc/Circle/Ellipse boundaries are validated and canonically nested by `BoundaryGeometry`. Region/Hatch records snapshot those loops with fresh topology identities. `RegionGeometry` owns semantic classification and measurement. Solid Hatch derives adaptive contours and monotone-band triangles; named Hatch derives bounded line families and clips them against semantic curves and Region classification. `ViewportScene` alone projects derived results into shared renderer-neutral batches consumed by Canvas2D and WebGPU.

The tolerance authority is `BoundaryTolerance`, scaled from the operation's finite model coordinates. It governs endpoint clustering, intersection deduplication, loop closure, tangency, area degeneracy, and nesting. Ambiguous touching, overlap, tangency, self-intersection, nonfinite geometry, and excessive complexity fail explicitly rather than being repaired.

## Limits and deterministic behavior

Boundary limits are 10,000 atomic curves, 250,000 candidate intersection tests, 50,000 intersections, 50,000 nodes, 100,000 half-edges/split edges, 10,000 edges per loop, 1,000 loops, and nesting depth 32. Solid Hatch limits are 100,000 flattened vertices and 250,000 triangles. Named Hatch limits are 16 families, 100,000 candidate lines, 1,000,000 total intersections, 20,000 intersections per line, 200,000 dash fragments, and 100,000 final segments.

Input order is normalized through canonical loop orientation/start, deterministic nesting order, sorted graph/family indices, deduplicated intersection parameters, and stable segment ordering. Very dense patterns fail before candidate-line allocation rather than silently changing scale or density.

## Hardened invariants

- Named pattern angles must be finite and canonical in `(-π, π]`; persisted noncanonical angles are rejected.
- Solid triangulation rejects named Hatch records, preventing a solid-fill derived API from becoming accidental authority for patterns.
- Pattern transforms validate resulting origin, angle, and scale and reject overflow before publication.
- Move translates pattern origin; Rotate transforms origin and angle; Scale transforms origin and spacing/dashes; Mirror derives angle from the mirrored direction; Copy allocates fresh topology identities.
- Selection, Window/Crossing, centroid grips, area, and perimeter use semantic boundaries/fill, never pattern gaps or derived strokes.
- Hidden/locked, layer, ByLayer, explicit property, atomic history, cancellation, and document replacement policies remain shared with ordinary native records.
- Persistence remains strict version 3 and rejects duplicate identities, malformed topology/patterns, unknown fields, and attempted derived triangle/segment fields.
- Region/Hatch expose no Osnap or Track candidates. Existing direct Osnap, tracking, Parallel, Tangent, HUD, and raw-cursor policies are unchanged.
- DXF Region/HATCH remains unsupported; export rejects the complete operation rather than omitting or exploding records.

## Rendering and draw order

Solid triangles and named pattern line segments are generated once per scene build in model space, projected once, and supplied identically to both renderers. Hatch fill/pattern precedes model linework, followed by selection/interaction overlays and annotations/HUD. Renderers perform no topology discovery, classification, triangulation, generation, or clipping.

## Deferred work

Associativity, Region Boolean operations, custom pattern files, gradients/transparency, advanced topology/origin grips, Region/Hatch Osnaps, exact ellipse discovery intersections, DXF Region/HATCH, and paper space remain deliberately deferred. The next track can build on the semantic loop schema, bounded discovery planner, Region classification/measurement API, Solid triangulation API, named-pattern registry/generator, atomic record replacement gateway, and renderer-neutral scene batches.
