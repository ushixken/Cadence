# R5 — Native Solid Hatch

R5 adds `hatch` as an independent, non-associative native snapshot record. A record owns stable record, loop, edge, and applicable endpoint feature identities; standard Layer, Color, Linetype, and Lineweight fields; copied semantic boundary loops; and exactly `pattern: { kind: "solid" }`. It contains no source IDs, Region references, flattened contours, triangles, or renderer caches. The existing version-3 persistence envelope is sufficient and was not bumped.

## Acquisition and ownership

`Hatch` (`H`) provides Select and Point modes. Select accepts native Regions, Hatches, direct closed Polyline/Circle/Ellipse boundaries, or Line/straight-Polyline/Arc sources. Point mode passes the authoritative resolved model coordinate to R3 Boundary Discovery. R3 proposals feed the same Hatch gateway used by direct selection. Multiple Region selections produce independent Hatches; discovered faces publish atomically. Sources remain untouched and future source edits cannot affect the Hatch snapshot.

## Semantic and derived geometry

R1/R2 loop topology remains authoritative for validation, selection, transforms, measurement, and persistence. `CaderactHatchGeometry` is the renderer-neutral derived-fill boundary. It adaptively flattens Arc, Circle, and Ellipse edges using a default maximum sagitta of one 4096th of the Hatch model-space span; Line endpoints remain exact. Flattening is deterministic and capped at 100,000 vertices.

Triangulation uses horizontal monotone-band decomposition. All flattened vertex Y values define bands; semantic contour crossings are sorted deterministically and paired by even/odd parity. Each filled interval becomes up to two finite, nondegenerate triangles. This handles holes, islands, deeper nesting, and disjoint components without delegating topology to Canvas fill rules. Output is capped at 250,000 triangles and failure is reported before publication.

## Rendering and interaction

ViewportScene projects the shared triangles into a `solidFillOverlay` and the existing triangle-group contract. Canvas2D and WebGPU consume those identical triangles and perform no Hatch topology calculations. Solid fills resolve normal ByLayer or explicit object color. Canvas draws Hatch triangles before linework; selection, grips, previews, and annotations remain above the fill. The Hatch does not add a separately stroked outline.

Selection classifies the pointer against semantic loops: filled outer areas and islands select, holes do not. Window/Crossing uses semantic boundary projection. Hidden and locked behavior is inherited from the standard document read sides. Editing is deliberately limited to one whole-object centroid translation grip.

Move, Copy, Rotate, Scale, Mirror, and Delete use the shared record paths. Mirror reverses semantic loop orientation consistently; validation remains authoritative. Copy creates fresh record, loop, edge, and endpoint identities. Derived fill is regenerated from transformed semantics. Area and Perimeter reuse Region semantic measurement and never inspect triangles.

Hatch contributes no Object Snap or Object Snap Tracking candidates. Native persistence stores only semantic loops, pattern, identities, and standard properties. DXF export rejects Hatch explicitly and atomically.

## R6 boundary

R6 may build Hatch editing and broader workflow polish on `recordGateway.createHatchFromLoops`, `CaderactHatchGeometry.flatten/triangulate`, and `solidFillOverlay`. Named patterns, hatch-line generation, gradients, associativity, Boolean Regions, topology grips, Hatch Osnaps, DXF HATCH, transparency, and paper-space behavior remain deferred.
