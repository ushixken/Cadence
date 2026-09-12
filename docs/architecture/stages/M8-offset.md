# M8 — Offset

Offset creates a new native record and never edits its input. The `Offset` / `O`
command starts in object selection with a transient default distance of `1`.
`Distance=<value>` is the U5B option: selecting it enters a positive-finite
numeric edit phase; empty Enter retains the current value, while valid input
returns to object selection. A source curve then previews the side under the
raw pointer and creates one record per click. The command retains its current
distance through the persistent select/preview loop until Enter or Escape.

`OffsetGeometry.js` is the authoritative, renderer-independent geometry layer.
Lines use a normalized perpendicular. Circles and arcs change only radius;
arcs retain center, endpoint directions, and signed sweep. The pointer is
classified against raw geometry rather than a snap target, preventing a nearby
snap from flipping the chosen side.

Polyline offsets use miter joins. Each segment is translated by its selected
left/right normal and adjacent translated infinite lines are intersected. Open
paths retain translated end points; closed paths intersect every adjacent pair.
Degenerate segments, parallel joins, collapsed vertices, non-finite results,
and miters beyond the bounded safety limit are rejected atomically. M8 does not
perform boolean cleanup for self-intersecting or otherwise pathological input;
unsafe results remain uncreated and the command stays retryable.

Ellipses are deliberately unsupported because changing axes is not a
constant-distance offset. No approximation is created.

Only Distance is exposed in M8. Loose, Corner, ThroughPoint, Trim, Tolerance,
BothSides, InPlane, Cap, OutputLayer, DeleteInput, and persistent settings are
deliberately deferred.

Preview records are transient geometry supplied to the existing viewport scene
and never enter document state, history, selection, or snapping. Publication
uses the document record gateway, so every result receives a fresh record and
feature identities, retains the source layer, and creates exactly one history
entry. Repeated clicks are separate transactions; Undo and Redo therefore act
on one created offset at a time.

Offset follows the shared [C1 command preselection](C1-command-preselection.md)
contract: one supported preselected source is retained through its distance
phase and becomes the side-selection source afterwards; invalid or multiple
selection falls back to ordinary source selection.
