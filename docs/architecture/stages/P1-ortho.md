# P1 — Ortho

P1 adds transient runtime Ortho state, defaulting off and resetting on document
replacement. Opted-in pointer sessions expose a model-space reference point.
The shared constraint projects the raw candidate horizontally when `|dx| >=
|dy|` and vertically otherwise, before D2A snap resolution; typed input is not
reprojected.

Shift inverts Ortho: it temporarily enables Ortho when off and temporarily
disables it when on. Shift no longer bypasses snaps. Modifier key transitions
re-resolve the stationary pointer so preview and accepted point share the same
constrained-and-snapped coordinate. Line and Polyline opt in through their
latest accepted point; additional linear workflows can opt in by exposing the
same session reference contract. Polar tracking and persistent settings remain
deferred.
