# P4 — Object Snap Tracking

P8 extends this foundation with active-guide intersections against committed geometry, manual point toggling, and an established-segment Parallel relationship; see [P8-advanced-object-snap-tracking.md](./P8-advanced-object-snap-tracking.md).

P4A introduced one ephemeral acquired P3 semantic snap. P4B extends the same
DOM-, renderer-, document-, and command-independent `ObjectSnapTracking`
controller to retain at most four acquired points. Stable eligible candidates
acquire after 500 ms. Nearly coincident points are deduplicated without
refreshing recency; exceeding the bound evicts the oldest acquisition.

Each acquired point contributes horizontal and vertical guides. The controller
checks the bounded set and activates only the closest deterministic projection,
or the two guides participating in a nearby H/V intersection. It also uses the
existing P2 Polar increment and 10-degree angular aperture to activate a Polar
ray from an acquired point. A bounded Polar-ray/H/V intersection is supported;
ray/ray intersections are deferred. No document scan or persistent construction
geometry is involved.

Candidate precedence is direct semantic Object Snap, tracking intersection,
single tracking projection/ray, Grid, then constrained/free movement. H/V ties
prefer horizontal, then acquisition order. P2 constrains from the current
command reference while P4B tracks from acquired object points; their state is
separate, even though they share increment/tolerance authority. The P6 HUD
continues to read the final viewport candidate.

## Renderer-neutral visuals

`ViewportScene` projects controller state into `objectTrackingOverlay`:
`acquiredPoints`, optional `candidatePoint` and `candidateKind`, the active
`guides`, viewport-spanning/ray `guideSegments`, and fixed-CSS-pixel
`markerSegments`. Acquired points use restrained cyan diamonds, the final
candidate a compact cross, and active H/V or Polar guides translucent cyan
lines. Only guides participating in the winner are emitted. A direct semantic
snap suppresses only the tracking candidate marker; acquired markers remain.

The overlay is also appended as ordinary line groups, so Canvas2D and WebGPU
consume identical projected data through their existing renderer-neutral draw
contract. Geometry and drafting previews render first, followed by temporary
tracking feedback and normal pointer feedback. Rebuild/recovery derives the
same overlay again without persistent mutation.

Unlimited points, configurable dwell/tolerance, extension tracking,
tangent/perpendicular origins, ray/ray intersections, permanent construction
lines, 3D behavior, and full SmartTrack-style behavior remain deferred.

## P4A runtime ownership

`objectSnapTrackingEnabled` is a `CaderactUserPreferences` boolean and defaults
to true. The footer-owned Track button reflects and changes the viewport runtime
state through one subscription; it is not document data and is absent from
history, revision, dirty state, and CAD serialization. Turning Track off clears
pending dwell, the acquired point, guide, candidate, and overlay immediately.
Turning it on starts with no stale acquisition. Tracking only observes active
point-acquisition commands. Command completion/cancellation, document
replacement, and Track off clear all state; pointer leave, blur, and visibility
loss cancel pending hover and active guide/candidate while retaining an acquired
point only for the active command. In P4B this policy applies to the entire
bounded acquired-point set.

Osnap master state is upstream authority for tracking. While Osnap is off, P4
observes no new semantic candidates and performs no projection. Turning the
master off clears pending, acquired, guide, and candidate state immediately;
turning it back on starts a fresh dwell. The Track preference is unchanged and
Grid never becomes a tracking origin.
