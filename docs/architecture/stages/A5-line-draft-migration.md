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
