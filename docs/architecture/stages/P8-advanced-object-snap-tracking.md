# P8 — Advanced Object Snap Tracking

## Relationship to P3/P4

P3 remains the only semantic object-snap solver. Its exact Endpoint, Midpoint, Center, Intersection, Vertex, Quadrant, Nearest, Perpendicular, and Tangent candidates continue to use the shared CSS-pixel aperture. P4 remains the bounded ephemeral tracking-point controller with a 500 ms dwell, four-point maximum, duplicate suppression, and oldest-first eviction. P8 extends arbitration around those authorities; it does not introduce another snap engine.

The final pointer order is: raw pointer, optional Ortho/Polar command constraint, P3 resolution, direct semantic Object Snap, tracking-guide/committed-geometry intersection, tracking-to-tracking intersection or tracking projection, Grid, then constrained/free point. Typed P5 input bypasses this pointer path.

## Guide-to-geometry intersections

The viewport converts only the currently active bounded P4 guides into curve descriptors and calls the existing `CaderactCurveIntersection.intersectAtomic` infrastructure against visible committed records. Horizontal and vertical guides use infinite line support; Polar guides use a forward ray. The committed side always respects its finite domain: Line and Polyline segments are bounded, Arc sweep is honored, and Circle/Ellipse use their supported full domains.

Candidates inside the existing eight-CSS-pixel tracking tolerance are ordered by screen distance, stable record ID, segment index, then coordinate. Locked visible geometry participates; hidden and transient geometry do not. The winning result carries its committed record reference. Consequently Line/Polyline acceptance treats a guide-to-geometry intersection as a real on-geometry finish candidate, while a pure tracking-to-tracking intersection remains non-finishing.

## Contextual relationships

Perpendicular and Tangent stay in P3 because they require the active command's authoritative reference point and already implement exact finite-domain math and semantic markers/HUD tags. They are unavailable before a reference exists. P8 does not duplicate their geometry inside tracking.

Parallel uses the smallest deterministic command-owned model: once Line or Polyline has two accepted vertices, the latest segment supplies a direction. Within a five-degree angular aperture, the pointer projects exactly onto the infinite line through the current vertex parallel to that segment. A directly acquired Draft Point retains priority, and Parallel has no first-point behavior. The shared tracking overlay draws the guide and Dynamic Input reports `OnParallel` from the final candidate.

## Manual acquisition and lifecycle

`Ctrl+Alt+T` toggles the currently acquired eligible semantic snap point. Shift is intentionally retained for temporary Ortho/Polar inversion; printable keys and P6 editing remain untouched. The shortcut is active only during a command, outside editable controls, and uses the same P4 collection, duplicate rule, four-point limit, and eviction order as dwell acquisition.

Track Off, Osnap Off, command completion/cancel/replacement, and document replacement clear tracking through existing lifecycle hooks. Source hiding invalidates referenced points; source locking retains them. Pointer leave and blur clear the active candidate/guide while retaining valid acquired points according to P4 policy. Tracking never changes document, history, revision, dirty state, selection, or persistence.

## Renderer and performance boundary

Viewport owns relationship and intersection decisions. `ViewportScene` projects the acquired markers, winning guide, and candidate into renderer-neutral CSS-pixel segments. Canvas2D and WebGPU only consume those supplied groups. Dynamic Input continues to derive coordinates and relationship tags from the final authoritative candidate.

The active guide count is bounded by the winning P4 relationship (normally one or two). Intersection work is therefore linear in visible atomic curves per pointer update, with deterministic analytic solvers for common primitives. No spatial index is justified at the current drawing scale; one remains an evidence-driven future optimization.

## Deferred

Polar-ray/Polar-ray combinations, arbitrary curve perpendiculars or tangencies, multiple simultaneous winning relationships, user-defined tracking angles, configurable tolerances/dwell, persistent construction geometry, 3D/planar constraints, and spatial indexing remain deferred.
