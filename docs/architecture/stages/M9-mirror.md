# M9 — Mirror

Mirror uses `GeometryTransform.mirrorPoint` and `mirrorRecord`, reflecting
coordinates across the infinite A→B axis by projection. A degenerate or
non-finite axis is rejected before any document transaction.

Reflection reverses orientation: native Arc geometry reflects center, start,
and end while negating its signed sweep, preserving the same minor/major arc
rather than its complement. Ellipse center is reflected and its `majorAxis`
is reflected as a vector about the axis direction. Polyline vertices retain
their order and open/closed state, so closed-path winding reverses naturally.

Mirror reuses Modify selection and D1/D2A point acquisition. Its preview uses
the renderer-neutral transform overlay and excludes selected sources during
second-axis snapping. Copy=No atomically replaces records, preserving record
and feature IDs and selection. Copy=Yes creates fresh gateway identities,
retains originals, and selects only the copies. Both paths use one transaction
and history entry; failed publication remains retryable.

Mirror maps its first selection role through the shared
[C1 command preselection](C1-command-preselection.md) contract.
