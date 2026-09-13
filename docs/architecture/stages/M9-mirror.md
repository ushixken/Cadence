# M9 — Mirror

Mirror uses `GeometryTransform.mirrorPoint` and `mirrorRecord`, reflecting
coordinates across the infinite A→B axis by projection. The axis is defined
solely by the two user-accepted world-space mirror-axis points; source-object
origins, endpoints, bounds, and the world origin never participate in its
definition. A degenerate or non-finite axis is rejected before any document
transaction.

Reflection reverses orientation: native Arc geometry reflects center, start,
and end while negating its signed sweep, preserving the same minor/major arc
rather than its complement. Ellipse center is reflected and its `majorAxis`
is reflected as a vector about the axis direction. Polyline vertices retain
their order and open/closed state, so closed-path winding reverses naturally.

Mirror reuses Modify selection and D1/D2A point acquisition. Its explicit
`mirror` preview carries A as its fixed base marker and the live resolved B as
its second marker, then calls the same pure record-reflection helper used for
commit. The overlay guide therefore represents the exact A→B axis (not a
source-derived rotate origin), and selected sources are excluded during
second-axis snapping. Copy=No atomically replaces records, preserving record
and feature IDs and selection. Copy=Yes creates fresh gateway identities,
retains originals, and selects only the copies. Both paths use one transaction
and history entry; failed publication remains retryable.

Mirror maps its first selection role through the shared
[C1 command preselection](C1-command-preselection.md) contract.

`mirrorCopyEnabled` is a user-level `CaderactUserPreferences` value, defaulting
to Yes. The Mirror Copy option updates it immediately, so its last chosen
value survives commands, cancellation, document replacement, and reload. It
is never part of drawing data, history, revisions, dirty state, or CAD-file
serialization; Reset to Defaults restores Yes.
