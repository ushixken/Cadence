# R3 — Boundary discovery and interior-point workflow

R3 layers the pure `CaderactBoundaryDiscovery` planner over R1 boundary geometry and R2 native Regions. The planner owns no document, renderer, command, or persistent identity state. Persistent IDs are allocated only after a complete proposal reaches the R2 record gateway.

## Planner pipeline

Supported discovery sources are Line, straight Polyline segments, and circular Arc. Records are flattened into semantic atomic curves. A deterministic x-axis sweep over exact semantic bounds produces candidate intersection pairs; disjoint bounds never enter the exact intersection phase. Exact R1 intersections are deduplicated and their native parameters feed R1 splitting, preserving Line pieces and signed Arc sweeps. Overlapping/coincident geometry and interior tangent contact fail explicitly.

R1 endpoint clustering maps split endpoints onto planner-local graph nodes without rewriting source coordinates. Recursively pruned degree-one branches cannot contaminate a face walk. Every remaining semantic piece has two directed half-edges. Outgoing half-edges are ordered by exact start-tangent angle, then stable graph identity. At a node, traversal chooses the immediately clockwise outgoing edge from the incoming twin, consistently keeping the candidate face on the left.

Each directed half-edge is consumed at most once. R1 validates every closed walk. Positive signed-area walks are bounded faces; clockwise exterior walks are rejected. Canonical edge-sequence keys deduplicate equivalent faces. Output order uses semantic area, bounds, then canonical topology and is independent of equivalent source selection order.

Disconnected nested loops use R1 `classifyNesting`: even depths are filled and counter-clockwise; odd depths are holes and clockwise. Disjoint roots become separate Region proposals. Subdivided faces that share boundaries remain separate proposals rather than being forced through a touching-loop nesting model.

## Command workflows

`Region` retains R2 direct creation and exposes `Select` and `Point` modes. Select first tries the direct R2 snapshot path; unordered/intersecting supported sources fall back to R3 discovery. One face creates one Region. Multiple disjoint or subdivided faces create deterministic independent Regions in one publication transaction. Sources are never modified or deleted.

Point mode considers visible Line, straight Polyline, and Arc records. Hidden records are excluded; visible locked records participate read-only, matching snap/track visibility policy. The accepted authoritative model point is classified semantically—never through pixels or renderer paths. A boundary hit is rejected. For nested topology, odd-depth cells are holes, even-depth islands are valid, and the smallest-area valid enclosing face wins with bounds/order tie-breaking. Candidate collection is capped by the planner's curve limit; R3 deliberately does not introduce a full drawing spatial index.

## Limits and diagnostics

Hard limits are 10,000 atomic curves, 250,000 broad-phase candidate pairs/exact tests, 50,000 accepted intersections, 50,000 nodes, 100,000 half-edges, and 1,000 extracted loops; R1 additionally enforces 10,000 edges per loop and nesting depth 32. Work aborts before exceeding these allocations.

Structured failures include no eligible geometry, no bounded/enclosing face, point on boundary, overlap/coincidence, ambiguous tangent contact/topology, unsupported curve, unsupported Ellipse discovery, invalid extracted loop, and complexity limits. Failure and cancellation publish nothing and add no history.

Full Ellipse and Circle remain supported by direct R2 Region creation. Ellipse intersection discovery is explicitly excluded because sampled ellipse intersections cannot be topology authority. Increasing tessellation density is not an R3 solution.

## R4 boundary

R4 can consume `discover(records)` proposals and `chooseAtPoint(plan, point)` without knowing graph internals. Deferred work includes a reusable drawing spatial index, Ellipse-safe exact intersections, associative boundaries, interactive discovery preview styling, boundary healing, Boolean Regions, and all Hatch/fill behavior.
