# A5 — Line draft migration

## Purpose

A5 moves accepted Line geometry out of the authoritative document until the
user finishes the command. A Line interaction is now a command-local draft;
only Enter can publish it. This gives one completed Line command one A4 history
entry without changing the A4 history engine or introducing a general command
framework.

## Draft representation

`LineDraftSession` privately owns:

- the current accepted point;
- the current pointer point used by the rubber-band preview; and
- an ordered array of accepted, immutable draft Line records.

Draft records receive their object and endpoint feature IDs when their segment
is accepted. They are not document records yet. The existing non-recycling ID
allocator intentionally leaves cancelled draft IDs unused.

The document-specific, command-agnostic `recordGateway` constructs validated
schema shapes with IDs and can atomically create a supplied record collection.
It owns no Line lifecycle or draft state. The Line session composes those two
generic capabilities and does not hold a document transaction while waiting
for pointer input.

## Lifecycle

Starting Line creates a fresh empty session. A first point updates only the
session's current point. Every later point creates one draft segment and moves
the current endpoint. Starting Line again cancels and replaces any existing
uncommitted session, so no earlier points or segments can leak.

Accepted draft segments render in the existing active-tool preview group. The
rubber band from the latest accepted point to the pointer is appended to that
same transient group. Authoritative geometry continues to come exclusively
from the document reader. No renderer/read-side redesign is part of A5.

### Enter

With no segment, Enter closes Line without opening a transaction or changing
document state, history, revision, state identity, or dirty state.

With one or more segments, Enter opens one short document transaction, stages
every draft record, validates the complete candidate, and publishes once. A4
therefore receives one exact change set and one history entry. Revision and
state identity each advance once regardless of segment count. On success, the
draft is cleared and Line exits.

### Close

After at least three distinct accepted points, Line exposes the semantic U5B
`Close` option. It derives one final segment from the latest accepted point to
the exact first accepted point and then uses the same atomic publication path
as Enter. If the user has already accepted the first point naturally, Close
does not add a duplicate segment. A failed publication retains the complete
draft, including its prepared closing segment, for an exact retry.

Line chain + Close remains a collection of independent native Line records in
one transaction and history entry. In contrast, Polyline + Close creates one
closed native Polyline record. Enter continues to publish an open Line chain,
and Line intentionally has no PersistentClose rubber band.

### Snap-to-start auto-completion

After a pointer click has passed through D2A, Line compares the accepted,
resolved model coordinate with the original draft point. If they are exactly
equal and Close is eligible, it derives the one final last-to-first Line and
publishes immediately. Hovering a marker never accepts a point and therefore
never completes the command. The trigger does not depend on CSS-pixel
proximity, visual marker overlap, or a particular snap candidate kind: Draft
Point, Endpoint, and Grid resolution all have the same result when their
accepted coordinate is P1. Shift bypass similarly cannot close merely because
the raw pointer is near P1; it closes only when the raw accepted coordinate is
itself exactly P1.

This uses the same Close transaction and failure policy: independent Lines are
created once, with no duplicate or zero-length seam; Undo removes the whole
chain and Redo restores its exact identities. Step Undo remains available until
the accepted close click. Explicit Close remains available, while Enter/Space
continue to finish an open chain normally.

### Escape

Escape discards the session in memory and exits. It performs no document
transaction and changes no persistent geometry, history, revision, state ID,
or saved/dirty identity.

### Step Undo

`stepUndoActiveCommand()` is explicit command-local routing, not A4 document
Undo and not a keyboard binding. It removes the latest draft segment and moves
the draft endpoint back to that segment's start. Repeated calls walk back to
the first point; a further call returns `no-step`. Persistent document and A4
history state are untouched.

### Accepted Line Draft Point Markers

During an active Line command, every accepted point (beginning with the first
point) immediately displays a small temporary square point marker centered at its
exact accepted coordinate.

Key properties:
- **Draft Source of Truth**: Point coordinates are queried directly from
  `LineDraftSession.acceptedPoints()`. This method returns a frozen array of
  deep-copied points `[P1, P2, ...]`, ensuring the draft session privately owns
  its geometry state while remaining immutable to callers.
- **Snap Parity**: Every point returned by `acceptedPoints()`, including the
  latest point used as the rubber-band origin, is an equal-priority
  `draft-point` snap candidate. Returning to that point may collapse the preview
  to zero length. The existing Line draft model permits accepting that point as
  a zero-length draft segment; it remains transient until normal Line finish.
- **Draft-only Lifecycle**: Accepted point markers exist strictly for the duration
  of the active draft. They update immediately when points are accepted or when
  `stepUndoActiveCommand()` walks back points. On final publication (Enter) or
  cancellation (Escape), all draft point markers are immediately discarded.
- **Renderer-Neutral Overlay Contract**: Projected draft points are rendered in
  the scene builder as `draftPointOverlay` (screen coordinates `point`) and placed
  in `lineGroups` (index 11) using the configured `draftPointColor`.
- **Distinction from UX2 Selection Grips**: Line draft point markers represent
  in-progress vertex inputs for the uncommitted Line command. They are NOT UX2
  selection grips: they do not route through `GripManager`, have no hover or drag
  interactions, and are never exposed as selectable handles.
- **Visual Vertex Continuity**: In Canvas 2D rendering where line segments are stroked
  with butt caps, acute and obtuse angle vertices can display minor triangular
  notches. The accepted point markers cover each joint precisely, matching
  CAD/Rhino drafting behavior and eliminating perceived disconnections during drafting.

### Fixed segments and next-segment preview

The active Line scene exposes accepted geometry and pointer feedback as separate,
renderer-neutral buffers. `acceptedDraftOverlay` contains only segments already
accepted by `LineDraftSession`; pointer movement never changes this buffer's
world inputs. `nextSegmentPreviewOverlay` contains only the rubber band from the
latest accepted point to the current resolved pointer point (or the transient
UX2 grip preview outside a Line command).

After a click, the former preview becomes a fixed accepted segment and a new
preview starts at the accepted endpoint. Draft markers remain above fixed
segments, while the snap marker renders last so acquisition remains visible.
Step Undo removes the latest fixed segment and marker and moves the preview
origin to the preceding accepted point. Enter retains the existing single A5
publication transaction; Escape discards all three transient representations.

## Final-commit failure

Final publication remains atomic through the A3/A4 controller. A validation or
stale outcome publishes nothing. An exception while acquiring/staging the
short transaction is returned as `commit-failed`, and an opened transaction is
rolled back before returning. For every unsuccessful outcome, the viewport
keeps Line active and preserves the complete draft for inspection or retry,
with the prompt reporting that the commit failed.

## A4 relationship

One successful multi-segment Line session is one transaction and one history
entry. One A4 Undo removes all its segments together; one Redo restores the
same records, object IDs, feature IDs, layer references, and coordinates.

## Remaining limitations

A5 adds no global Ctrl+Z/Ctrl+Y routing or user-facing Step Undo control. It
does not introduce A6 read-side migration, other drawing commands, solvers,
snapping, persistence, layers work, command-history UI, or renderer recovery.
Manual UX acceptance and later command-lifecycle work can decide how Step Undo
is exposed without changing this draft contract.
