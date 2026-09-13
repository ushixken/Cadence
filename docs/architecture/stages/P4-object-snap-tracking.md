# P4 — Object Snap Tracking

P4A owns one ephemeral acquired P3 semantic snap in
`ObjectSnapTracking`. After its dwell, the shared viewport point pipeline may
project the constrained pointer onto a horizontal or vertical guide through
that point. Direct semantic Object Snap remains above tracking, followed by
Grid and then free/constrained movement.

## Renderer-neutral visuals

`ViewportScene` projects controller state into `objectTrackingOverlay`:
`acquiredPoint`, optional `candidatePoint`, `guideKind`, viewport-spanning
`guideSegments`, and fixed-CSS-pixel `markerSegments`. The acquired point uses
a restrained cyan diamond, the candidate a compact cross, and the active guide
a translucent cyan line distinct from Polar feedback. A direct semantic snap
suppresses only the tracking candidate marker; the acquired marker remains.

The overlay is also appended as ordinary line groups, so Canvas2D and WebGPU
consume identical projected data through their existing renderer-neutral draw
contract. Geometry and drafting previews render first, followed by temporary
tracking feedback and normal pointer feedback. Rebuild/recovery derives the
same overlay again without persistent mutation.

P4A-4 Track preference/footer behavior remains deferred. Multiple acquired
points, guide intersections, acquired-point Polar rays, configurable dwell or
tolerance, and SmartTrack-style behavior are outside P4A.

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
point only for the active command.
