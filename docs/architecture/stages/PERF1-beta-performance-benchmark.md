# PERF1 — Beta performance benchmark

PERF1 establishes a reproducible diagnostic baseline without changing production behavior. Run it explicitly with:

```text
node benchmarks/perf1-benchmark.cjs
```

The runner uses compact deterministic generators; it does not store large fixture files and is intentionally excluded from `npm test`.

## Environment and methodology

Recorded 2026-09-28 on Windows x64, Node 25.3.0, AMD Ryzen 5 5500 (12 logical CPUs), 31.9 GiB RAM. The runner uses Caderact's browser VM harness and the real document, persistence, viewport-scene, selection, SnapResolver, BlockTraversal, PlotScene, PDF, and DXF authorities.

Repeated pure operations receive one warm-up and normally five timed samples; large serialization, load, scene, DXF, plot, and PDF operations receive three. Tables report median and observed min–max. General-fixture bootstrap/creation/publication is a single combined measurement because rebuilding 100k-record VM documents repeatedly would dominate the run; specialized fixture creation excludes harness bootstrap. Intersection scaling is intentionally one sample per size because the current algorithm is quadratic.

These are deterministic core and renderer-neutral scene-preparation timings, not GPU frame times or interactive browser telemetry. Pan/zoom figures include full scene reconstruction. End-of-process memory is only a coarse upper observation because the process retains all VM fixtures; serialized payload size is the reliable per-fixture comparison.

## Fixtures

- General geometry: 10k, 50k, and 100k deterministic Lines.
- Block-heavy: 10k instances of a two-level nested Block graph with Line/Circle leaves and varied rotation, scale, and reflection.
- Annotation-heavy: 1,500 Text, 1,500 linear Dimensions, and 1,500 Leaders.
- Hatch-heavy: 1,000 named ANSI31 rectangular Hatches.
- Mixed: 20k evenly distributed Lines, Circles, Polylines, Text, and linear Dimensions.
- DXF: 20k supported Lines.
- Plot/PDF: 10k Lines through one locked Layout viewport at 1:1.
- Intersection scaling: 250, 500, and 1,000 Lines with semantic Intersection enabled.

## Key results

All times are milliseconds.

| General Lines | 10k | 50k | 100k |
|---|---:|---:|---:|
| Harness bootstrap + create + publish, one run | 680 | 2,356 | 4,780 |
| Native serialize, median | 142 (139–145) | 806 (757–874) | 1,546 (1,522–1,586) |
| Native parse + load, median | 417 (410–481) | 2,528 (2,101–2,630) | 4,578 (4,383–4,616) |
| Viewport scene, median | 154 (132–157) | **stack overflow** | **stack overflow** |
| Pan + scene, median | 202 (200–218) | **stack overflow** | **stack overflow** |
| Zoom + scene, median | 187 (185–205) | **stack overflow** | **stack overflow** |
| Window selection, median | 26 (25–34) | 207 (189–254) | 437 (417–533) |
| Select All, median | 33 (31–35) | 244 (239–250) | 593 (574–715) |
| Osnap without Intersections, median | 105 (103–136) | 605 (562–645) | 1,237 (1,134–1,284) |
| Line draft preview core, median | 0.005 | 0.005 | 0.007 |
| Native payload size | 2.92 MiB | 14.62 MiB | 29.34 MiB |

The 50k/100k scene failure is deterministic. `ViewportScene` spreads a large same-style segment array into another array; argument-count/stack limits are exceeded before a scene can be returned. This also prevents measured pan/zoom reconstruction at those sizes. It is a PERF2 correctness/performance target, not optimized in PERF1.

| Specialized scenario | Size | Operation | Median (range) |
|---|---:|---|---:|
| Nested Blocks | 10k instances | Traverse all instance graphs | 150 (148–153) |
| Nested Blocks | 10k instances | Scene preparation | 695 (660–712) |
| Annotations | 4,500 records | Scene preparation | 131 (109–131) |
| Annotations | 4,500 records | Serialize | 78 (77–85) |
| Named Hatch | 1,000 records | Scene preparation | 364 (360–377) |
| Named Hatch | 1,000 records | Serialize | 168 (153–242) |
| Mixed | 20k records | Scene preparation | 388 (382–540) |
| Mixed | 20k records | Serialize | 370 (327–462) |
| DXF | 20k Lines / 1.48 MiB | Export | 898 (884–980) |
| DXF | 20k Lines / 1.48 MiB | Import | 1,120 (1,014–1,153) |
| Plot scene | 10k segments | Prepare | 73 (72–90) |
| Vector PDF | 10k segments / 0.43 MiB | Serialize | 28 (28–30) |

Snap resolution with Intersections enabled measured 241 ms at 250 Lines, 581 ms at 500, and 2,374 ms at 1,000. This is consistent with the current all-pairs intersection scan. Direct endpoint/midpoint snapping still scans and sorts all eligible records, producing roughly linear-to-`n log n` growth and exceeding one second at 100k records. Tracking projection itself is small and ephemeral, but its usable pointer path inherits candidate-generation cost; Extension/Track therefore cannot be considered interactive at these sizes without candidate narrowing.

## Scaling and diagnosis

1. **Scene aggregation has a hard large-array failure.** The immediate cause is large spread operations during property-bucket consolidation. Even below failure, every pan/zoom rebuilds the full scene instead of processing only visible/changed records.
2. **Intersection Osnap is the dominant interactive bottleneck.** The all-pairs scan is visibly quadratic by 1,000 Lines. Other semantic candidates scan and sort the full document on every resolution.
3. **Selection and Select All scan full record collections.** They scale acceptably for occasional commands at 10k, but hundreds of milliseconds at 50k–100k are no longer interactive.
4. **Native load is slower than save preparation.** Validation, reconstruction, identity/reference checks, and freezing produce approximately linear multi-second load times at 50k–100k.
5. **Hatch cost is geometry-amplified.** Only 1,000 small Hatches take about 364 ms to prepare, more per record than ordinary geometry, because pattern/loop presentation expands into many primitives.
6. **Nested Blocks are bounded but expensive in aggregate.** Pure traversal of 10k two-level instances is about 150 ms; full scene projection is about 695 ms.
7. **Plot/PDF is comparatively healthy for simple vectors.** A 10k-segment PlotScene plus vector serialization remains under roughly 120 ms combined in this harness. Rich annotation/hatch plot cases should be added after the primary viewport bottlenecks.
8. **Command-local draft math is not the problem.** Line preview state updates remain microsecond-scale. The surrounding whole-document snap and scene work dominates pointer-driven commands.

## Memory observations

General Line native payloads scale predictably from 2.92 MiB at 10k to 29.34 MiB at 100k, about 300 serialized bytes per Line including document tables and identities. The final benchmark process reached approximately 924 MiB RSS and 286 MiB used heap while retaining every VM fixture and repeated results. That number is deliberately not presented as per-document browser memory; a future browser profile with forced fixture disposal and heap snapshots is required for reliable retained-memory attribution.

## PERF2 priorities

1. Replace large array spreads in `ViewportScene` with bounded iterative appends; add 50k/100k no-throw regression coverage.
2. Introduce a measured spatial candidate index or viewport/aperture prefilter shared by selection and SnapResolver. Preserve semantic priority and exact snapping.
3. Eliminate all-pairs Intersection work outside spatially relevant candidate sets; keep deterministic ordering and compound-snap behavior.
4. Add view culling and/or incremental scene reuse for pan/zoom, then measure real browser frame time with Canvas2D and WebGPU independently.
5. Reduce repeated full-record copies/sorts across `visibleRecords`, selection, and scene construction without creating a second document authority.
6. Cache or bound Hatch presentation tessellation using immutable semantic keys and measure invalidation correctness.
7. Profile native load validation/freeze stages separately before changing persistence architecture.
8. After the above, add real-browser traces for single selection, selection cycling, Track/Extension pointer paths, Dynamic Input, and GPU submission; Node VM timings must not substitute for those measurements.

No arbitrary performance thresholds are asserted. PERF2 should preserve all existing correctness tests and compare results against this runner on the same machine and runtime.
