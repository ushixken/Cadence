# M8 — Offset

Offset creates a new native record and never edits its input. The `Offset` / `O`
command accepts a positive finite distance, selects one source curve, previews
the side under the raw pointer, and creates one record per click. It stays in
the select phase with the same distance until Enter or Escape.

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

Preview records are transient geometry supplied to the existing viewport scene
and never enter document state, history, selection, or snapping. Publication
uses the document record gateway, so every result receives a fresh record and
feature identities, retains the source layer, and creates exactly one history
entry. Repeated clicks are separate transactions; Undo and Redo therefore act
on one created offset at a time.
