# PERF2 — Targeted beta performance optimization

PERF2 removes measured pathological behavior without changing document, command, renderer-neutral scene, or file-safety semantics.

## Candidate-query authority

`CaderactSpatialQuery` is a small uniform-grid authority over conservative record bounds. Screen-space indexes serve CSS-aperture operations; a conservative overflow set retains records whose presentation cannot be bounded safely. Direct Object Snap candidates retain their existing ranking, but only records whose projected bounds can enter the aperture are enumerated. Intersection Osnap pairs only those spatially plausible records. The persistent resolver reuses its index while record identities and the camera transform remain unchanged, and rebuilds after either changes.

Window/Crossing selection uses the same conservative screen query for uniquely identified records, followed by the existing exact geometry predicates. Expanded Block proxy sets retain their complete aggregate all/any path. Select All remains deliberately O(n), but accepts the already-authoritative complete record IDs without redundant Group target expansion.

## Scene safety and derived presentation

Large bucket consolidation uses bounded iteration instead of JavaScript argument expansion, so 50k and 100k scenes complete without an engine call-stack limit. The renderer-neutral scene contract remains an all-record contract; no arbitrary record cap or semantic culling is introduced.

Named and solid Hatch world-space presentation is cached by immutable record identity. Camera changes re-project cached presentation. Any Hatch geometry or presentation-property edit publishes a new immutable record and therefore invalidates exactly that cache entry. General camera changes still re-project the complete renderer-neutral scene; deeper camera/renderer separation is deferred because changing the existing scene contract would be a broader renderer architecture change.

## PERF1 comparison

Environment: Windows x64, Node v25.3.0, AMD Ryzen 5 5500. Values are medians from the deterministic Node VM harness and are not GPU frame timings.

| Scenario | PERF1 before | PERF2 after |
| --- | ---: | ---: |
| Scene 10k | 142.324 ms | 159.889 ms |
| Scene 50k | stack overflow | 1,133.271 ms |
| Scene 100k | stack overflow | 2,176.331 ms |
| Ordinary Osnap 10k | 105.174 ms | 85.204 ms |
| Ordinary Osnap 50k | 576.234 ms | 449.033 ms |
| Ordinary Osnap 100k | 1,345.996 ms | 964.334 ms |
| Intersection Osnap 250 | 173.111 ms | 16.686 ms |
| Intersection Osnap 500 | 601.560 ms | 20.738 ms |
| Intersection Osnap 1,000 | 2,536.778 ms | 21.990 ms |
| Window selection 10k | 24.283 ms | 26.450 ms |
| Window selection 50k | 200.264 ms | 245.319 ms |
| Window selection 100k | 472.227 ms | 464.263 ms |
| Select All 10k | 34.187 ms | 23.505 ms |
| Select All 50k | 246.133 ms | 179.406 ms |
| Select All 100k | 555.500 ms | 471.453 ms |
| Nested Block traversal / scene | 163.743 / 675.937 ms | 165.465 / 693.812 ms |
| 1,000 named Hatches scene | 382.368 ms | 12.779 ms |
| Native load 100k | 4,915.729 ms | 4,549.610 ms |
| PlotScene / PDF 10k | 65.443 / 43.013 ms | 66.737 / 28.146 ms |

Selection candidate filtering is intentionally conservative. The PERF1 selection rectangle covers most of its fixture, so the spatial query falls back to the exact linear pass; 10k/50k variation is benchmark noise/cost and only the 100k result improves slightly. Smaller localized picks and boxes benefit from filtering. General Line pan/zoom completes at 50k/100k but still requires full scene reprojection and remains the main deferred interactive bottleneck.

## Regression contract

Focused structural coverage proves 100k scene completion, conservative candidate narrowing, and snap-index invalidation after immutable replacement. Existing Object Snap, P9, Track/Extension, transformed Block, selection, Hatch, renderer, Layout/Plot/PDF, persistence, recovery, and file-safety suites remain authoritative.
