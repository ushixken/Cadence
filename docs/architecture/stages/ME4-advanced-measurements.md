# ME4 — Advanced measurements

`CaderactMeasurement` remains the sole pure model-space authority. `measureIncludedAngle` returns the smaller unsigned angle in `[0, π]` and rejects either zero-length ray. `measurePointToRecord` supports finite Line, Circle, finite-sweep Arc, and every native Polyline segment including its closed seam. Circle-center coincidence returns the exact radius with `targetPoint: null`. Ellipse is explicitly unsupported because the existing affine pick parameter is not a true Euclidean-nearest solver.

`measureRecordToRecord` first uses the established finite-domain intersection system, returning zero and a deterministic intersection point. Non-intersecting Line/Circle/Arc pairs use finite endpoints, clamped projections, radial critical points, and Arc sweep filtering. Polyline pairs decompose into bounded Line segments: point-to-Polyline is O(n), and Polyline-to-Polyline is O(nm). The existing `1e-9` geometry tolerances remain authoritative; no new snap or screen tolerance is introduced.

`Angle`/`ANG` uses three resolved points and presents two renderer-neutral rays plus a live P6 included-angle field. `DistanceObject`/`DOBJ` accepts a resolved source point then a visible target record. `MinDist` accepts two visible records, with one valid preselection optionally serving as the first. Their connector preview is the same renderer-neutral ME1 measurement overlay and is omitted when a nearest point is non-unique. `DistanceSum`/`DSUM` accepts resolved points until Enter, rejects zero-length steps, reports live Segment and Total fields, and supports command Step Undo.

All point phases reuse Ortho, Polar, P3/P9 Osnap, P8 tracking/geometry intersections, and Grid. Object picks use visible—not editable—records, allowing locked geometry and excluding hidden geometry. Every result is observational: no records, layers, properties, history, revision, dirty state, or persistent preview geometry change.

Deferred: arbitrary boundary discovery, independent-Line regions, Arc sector/segment area, general Ellipse distances, splines/NURBS, persistent dimensions/annotations, parametrics, and a measurement-history panel.
