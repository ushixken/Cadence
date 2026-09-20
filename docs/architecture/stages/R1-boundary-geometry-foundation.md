# R1 — Boundary geometry foundation

R1 adds a pure, document-free geometry foundation for future Region, Boundary and Hatch work. It does not add records, commands, persistence, rendering, properties, snaps or DXF behavior.

## Modules and API

`BoundaryTolerance` owns the operation-scoped model tolerance and point equivalence. `BoundaryGeometry` owns immutable semantic edges, loop validation/canonicalization, metrics, point classification, nesting, endpoint clustering, intersection deduplication and line/arc splitting.

The R2-ready public surface is:

- `CaderactBoundaryTolerance.create(points)` and `samePoint(a, b, tolerance)`
- `CaderactBoundaryGeometry.adaptEdge(value)`
- `adaptClosedPolyline(record)`
- `evaluate(edge, parameter)` and `tangent(edge, parameter)`
- `edgeBounds`, `edgeLength`, and `edgeAreaContribution`
- `intersections(edgeA, edgeB, tolerance, limit)`
- `splitEdge(edge, parameters, tolerance, limit)`
- `clusterEndpoints(points, tolerance, limit)`
- `validateLoop(edges, tolerance)`
- `canonicalizeLoop(edgesOrLoop, options)` and `reverseLoop(loop)`
- `classifyPoint(loop, point, tolerance)`
- `classifyNesting(loops, tolerance)`
- centralized immutable `LIMITS`

All results are immutable structured `{valid: true, ...}` or `{valid: false, reason, ...}` values. The modules reuse `CurveDescriptor`, `CurveParameter`, `CurveIntersection`, `ArcGeometry`, and `EllipseGeometry`; they do not create a parallel general geometry kernel.

## Tolerance policy

For one operation:

```text
linear = max(
  1e-9,
  1e-12 × max(1, local bounding-box diagonal),
  32 × Number.EPSILON × max(1, maximum absolute coordinate)
)
```

Parameter tolerance is `max(1e-12, linear / max(1, extent))`; area tolerance is `linear × max(1, extent)`. The local extent term scales with geometry size while the ULP term protects large translated coordinates. No tolerance depends on CSS pixels, DPR, zoom, camera or renderer state.

Tolerance establishes topology/equivalence only. Near-equal input coordinates are not rewritten or silently persisted as snapped coordinates.

## Semantic edges and loops

Supported immutable edges are:

- `line`: exact start and end
- `arc`: exact center, radius, start, end and signed sweep
- `circle`: exact center and radius with semantic closure
- `ellipse`: exact center, major-axis vector and minor radius with semantic closure

A `boundary-loop` contains ordered exact edges, orientation, signed/absolute area, semantic perimeter and bounds. Multi-edge loops contain Line/Arc chains whose adjacent endpoints agree under the operation tolerance. Circle and Ellipse are valid one-edge loops without fabricated duplicate vertices.

The default canonical orientation is counterclockwise. Reversal reverses edge order and Line endpoints, negates Arc sweeps, and reverses Circle/Ellipse traversal. The canonical seam for a multi-edge loop is chosen deterministically from semantic start-point keys.

## Analytic measurements

Line and Arc signed-area contributions use the Green's-theorem line integral. Arc length is `abs(sweep) × radius`. Circle area/perimeter use `πr²` and `2πr`. Ellipse area uses `πab`; its perimeter uses the deterministic Ramanujan approximation because no elementary exact perimeter exists. Renderer tessellation is never a measurement authority.

## Topology and point classification

Line/Arc intersection queries delegate to the existing intersection kernel, retain only finite-domain hits, deduplicate them using the boundary tolerance, and sort by native parameters. Line and Arc splitting preserves semantic edge types and signed Arc sweeps.

Endpoint clustering uses tolerance-sized spatial buckets plus deterministic union/find representatives. The representative is the lexicographically smallest original coordinate; source descriptors are never mutated. Processing stops at configured node limits.

Point classification returns `inside`, `outside`, or `boundary`. Boundary distance uses semantic curve projection. Mixed Line/Arc loops use an analytic horizontal-ray winding test. Direct Circle and full Ellipse loops use their exact implicit geometry.

Nesting rejects intersecting/touching loop sets, chooses the smallest containing parent, reports explicit `parentIndex` and `depth`, and derives fill by parity. Even-depth loops canonicalize CCW; odd-depth holes canonicalize CW. Islands and deeper nesting alternate deterministically.

## Strict ambiguity policy

R1 rejects open loops, non-finite or degenerate edges, zero-area loops, self-crossings, coincident/overlapping edges, duplicate edges, non-adjacent touches, invalid tangent contacts and crossing/touching loop sets. It returns structured failures rather than repairing geometry.

## Complexity limits

- Atomic curves: 10,000
- Intersection tests: 250,000
- Accepted intersections: 50,000
- Endpoint nodes: 50,000
- Split edges: 100,000
- Edges per loop: 10,000
- Loops: 1,000
- Nesting depth: 32

Limits are checked during processing. R1 does not expose a half-edge graph; R3 may build one behind its own bounded planner.

## Ellipse boundary

Full Ellipse is supported as a direct closed semantic loop with analytic area and exact implicit point classification. Intersection-driven Ellipse discovery is explicitly unsupported in R1 because the existing sampled ellipse intersection solver can miss even-order tangent roots. R2 may create a Region directly from a full Ellipse; R3 must not use sampled ellipse intersections as topology authority.

## R2/R3 boundary

R2 can consume validated/canonical loops to create non-associative Region snapshots. R3 can use clustering, intersection deduplication and semantic splitting to construct a bounded planar graph. Neither stage should duplicate tolerance, area, containment or orientation logic.
