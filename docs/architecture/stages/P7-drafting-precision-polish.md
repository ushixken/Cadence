# P7 — Drafting and Precision Polish

P7 consolidates the P1–P6 interaction contract. The footer terminology is
deliberately narrow: **Grid Snap** quantizes to the grid lattice, **Ortho** and
**Polar** constrain direction, **Track** retains temporary object-derived
construction guides, and **Osnap** acquires semantic object features. The Osnap
menu owns only its master switch and Endpoint, Midpoint, Center, Intersection,
Vertex, Quadrant, Nearest, Perpendicular, and Tangent modes. Polar owns angular
tracking and its increment.

Every footer indicator reads runtime state rather than maintaining UI-local
state. Ortho and Polar display their effective Shift-inverted state; Grid Snap,
Track, and Osnap display their persisted runtime state. Preference reset updates
these subscriptions immediately.

## Final point pipeline

Pointer-driven point phases use one authoritative path:

1. raw world pointer;
2. effective Ortho or P2 Polar constraint when a command reference exists;
3. direct semantic P3 Object Snap;
4. P4 tracking intersection or single guide/ray projection;
5. continuous Grid Snap;
6. constrained/free point;
7. P6 HUD and command preview/acceptance.

Direct semantic Osnap always wins. Typed P5 values enter the command acceptance
path directly and are not snapped or constrained a second time. Offset side
classification explicitly consumes the raw pointer and does not participate in
point snapping, constraints, tracking, or the coordinate HUD.

Static Endpoint, Vertex, Midpoint, Center, Intersection, Quadrant, and Nearest
are available before a command reference or P1 exists. Perpendicular and Tangent
remain contextual. The resolver keeps a deterministic primary snap plus ordered
same-point contributing kinds; presentation converts those into short compound
labels. Relationship feedback is carried with the final point and is not
reverse-engineered from cursor geometry.

Shift inverts effective Ortho and temporarily frees Polar. It never bypasses
Osnap or Grid Snap. Modifier changes recompute stationary pointer previews;
command-bar text and active HUD editing retain their existing keyboard ownership.

## Command support matrix

“Distance” includes P5 bare/relative distance where a reference exists. HUD
editability names the primary editable field rather than every displayed value.

| Command | First-point snap | Ortho | Polar | Osnap | Track | Direct numeric | HUD | Editable HUD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Line | Yes | Yes | Yes | Yes | Yes | Distance/point | Yes | Distance |
| Polyline | Yes | Yes | Yes | Yes | Yes | Distance/point | Yes | Distance |
| Rectangle | Yes | Yes | Yes | Yes | Yes | Distance/point | Yes | Distance |
| Circle | Center | Radius phase | Radius phase | Yes | Yes | Radius/point | Yes | Radius |
| Arc | Yes | After P1 | After P1 | Yes | Yes | Distance/point | Yes | Distance |
| Ellipse | Yes | After P1 | After P1 | Yes | Yes | Distance/point | Yes | Distance |
| Polygon | Center | Radius phase | Radius phase | Yes | Yes | Radius/point | Yes | Distance |
| Move | Base point | Target | Target | Yes | Yes | Distance/point | Yes | Distance |
| Copy | Base point | Target | Target | Yes | Yes | Distance/point | Yes | Distance |
| Rotate | Center | Reference/target | Reference/target | Yes | Yes | Angle/point | Yes | Angle |
| Scale | Base point | Reference/target | Reference/target | Yes | Yes | Factor/point | Yes | Factor |
| Mirror | First axis point | Second axis point | Second axis point | Yes | Yes | Distance/point | Yes | Distance |
| Offset | Not applicable | No | No | No | No | Offset distance | No | No |

## Preferences and lifecycle

`CaderactUserPreferences` remains the sole user-level authority for grid
visibility and snapping, Ortho, Polar and its increment, the Osnap master and
individual modes, Track, Dynamic Input, Mirror Copy, and grid/axis appearance.
Validation falls back to defaults. Reset restores every preference, including
footer-only controls. New/Open preserve preferences. None are drawing records,
history entries, revisions, dirty state, or CAD serialization fields.

Snap markers, tracking points/guides, Polar guides, HUD state, and pointer state
remain ephemeral. Escape, command completion/replacement, document replacement,
Track off, pointer leave, blur, and visibility loss follow the lifecycle defined
by [P1](P1-ortho.md), [P2](P2-polar-tracking.md), [P3](P3-object-snaps.md),
[P4](P4-object-snap-tracking.md), [P5](P5-precision-numeric-input.md), and
[P6](P6-dynamic-input.md).

Deferred work includes new snap modes, ray-to-ray tracking intersections,
extension tracking, configurable tracking tolerances/dwell, parametric
constraints, measurement commands, 3D drafting, and broader workspace/UI
customization.
