# ME3 — Area and perimeter

## Authority and supported records

`CaderactMeasurement.measureRecord` remains the sole formula owner. Circle exposes exact `πr²` area and circumference/perimeter. Ellipse exposes exact `πab` area; perimeter remains unsupported because the repository has no accepted approximation policy. A native closed Polyline exposes its existing exact boundary length as perimeter plus shoelace signed area and absolute presented area. Open Polylines expose path length only. Arc area is intentionally absent because an Arc alone does not choose sector versus segment semantics.

Rectangle and Polygon commands publish independent Line records, with no persistent region record or authoritative group boundary. ME3 therefore never reconstructs their area from neighboring Lines. A native closed Polyline is the supported polygonal region representation.

## Polyline validity

Shoelace accumulation is O(n), uses the authoritative vertex order, and supplies `signedArea` for orientation plus non-negative `area` for presentation. The implicit last-to-first edge is included without requiring a duplicate first vertex. Structurally closed degenerate/collinear geometry has area zero.

Before exposing area, non-adjacent segment pairs are checked in O(n²) using the project's model-space intersection tolerance. Ordinary adjacent shared vertices and first/last adjacency are ignored. Proper crossings, non-adjacent endpoint contacts/repeated vertices, and collinear overlap make the boundary self-intersecting/ambiguous; AREA is unsupported while perimeter remains valid.

## Commands, formatting, and isolation

`Area` and `Perimeter` (`PERIM`) reuse ME2 visible-record picking, immediate valid single preselection, locked-visible permission, hidden exclusion, retryable unsupported feedback, and repeat-last behavior. AREA also reports exact perimeter when available. `CaderactUnits.formatArea` is a semantic squared-unit boundary (`mm²`, etc.); numeric results remain unrounded model-space Numbers.

Properties consumes the same result object for Circle circumference/area, Ellipse radii/diameters/area, and closed Polyline perimeter/area. No command or panel path publishes geometry, history, revision, dirty state, layer, or property changes.

Deferred to ME4 or a region subsystem: arbitrary picked boundaries, multiple-Line region construction, additive/subtractive areas, Arc sector/segment area, included angles, and curve/object distance modes.
