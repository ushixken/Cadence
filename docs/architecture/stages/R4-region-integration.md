# R4 — Region integration and beta completion

R4 integrates the native Region record with the existing layers, object-properties, measurement, selection, transform, grip, and persistence authorities. It does not introduce a parallel Region UI or duplicate geometric calculations.

## Properties and layers

Region records use the standard `layerId`, color, linetype, and lineweight properties. The Layers and Properties panels therefore use the same multi-selection aggregation, `MIXED` state, locked-layer rules, publication transaction, and Undo/Redo behavior as other native records. The Properties geometry section identifies the record as Region and reports semantic Area, Perimeter, and Loop Count.

## Measurement authority

`CaderactRegionGeometry.measure` is the exact model-space authority. Each validated boundary edge contributes through R1 boundary geometry: Line length and area terms remain analytic, as do Arc, Circle, and Ellipse contributions. Filled even-depth loops add area, hole loops at odd depth subtract area, and every loop contributes to total perimeter. Islands and deeper nesting follow the same parity rule. The Area and Perimeter commands consume this shared result and never derive values from renderer tessellation.

## Selection and transforms

Production pointer hit-testing converts the screen pointer back to model space and uses Region point classification for filled-interior, hole, and island semantics. Projected boundary segments are used only for the fixed CSS-pixel boundary aperture. Window/Crossing selection continues to operate on renderer-neutral semantic edge projections, never framebuffer pixels.

Move, Copy, Rotate, Scale, and Mirror use the shared geometry-transform and publication paths. Nesting metadata and semantic edge kinds are preserved; mirror reverses boundary orientation consistently. Replacement transforms preserve identities, while Copy allocates fresh record and feature identities. Failed or cancelled operations remain non-publishing.

## Grips and snapping policy

R4 intentionally retains one whole-object centroid grip. Safe per-edge or per-vertex editing would require coordinated adjacent-edge reconstruction plus full topology and nesting revalidation, so it is deferred rather than exposing partial edits that could corrupt a Region.

Regions are deliberately excluded from Object Snap and Object Snap Tracking in this beta. Their source geometry remains independently available for snapping when retained. Adding Region snap features later requires stable native Region feature identities and must not derive authority from tessellated display segments.

## Persistence and interoperability

Native Region topology round-trips through the existing version-3 persistence path, including nested loops, semantic curves, properties, and stable identities. Older supported documents remain compatible. DXF export continues to reject native Regions explicitly instead of silently flattening or losing hole semantics; DXF import does not invent Regions.

## Deferred work

Associative source boundaries, Boolean operations, Hatch/fill, Region-specific edge/vertex grips, Region Osnap/Track features, exact ellipse discovery intersections, and DXF Region flattening policy remain outside R4.
