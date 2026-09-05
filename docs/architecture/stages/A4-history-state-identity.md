# A4 — History and state identity

## Purpose

A4 adds document-level linear Undo/Redo and persistent content-state identity
to Caderact's existing A3 transaction controller. It is controller-owned
history, not browser navigation history, and it has no keyboard or command-bar
binding yet.

## Linear history

The controller stores one ordered list of successful, non-no-op transaction
entries and a cursor. The cursor is the count of entries currently applied:

```text
initial state (cursor 0) -> entry A (1) -> entry B (2)
```

Undo applies the entry immediately before the cursor and moves it backward.
Redo applies the entry at the cursor and moves it forward. The history list is
private; callers receive only safe `historyInfo`, `canUndo`, and `canRedo`
readouts.

Each entry contains a transaction ID, document ID, change-set version, base and
published revisions, before/after state IDs, and immutable copies of each exact
record change. A change uses `null` for explicit absence. A4 stores changed
payloads rather than full document snapshots.

## Exact-value traversal

Undo applies each entry's recorded `before` values; Redo applies its recorded
`after` values. They do not rerun a command, invoke a solver, calculate an
inverse, or allocate replacement object/feature IDs. Candidate documents are
validated and then published once. Before traversal, the controller checks that
the current record values match the expected opposite side. A mismatched or
invalid candidate returns `integrity-failed` with no document, revision, state,
or cursor change.

The current document assembly/validation path copies the full record table and
validates the candidate, so publication remains O(N) in the current document
size. History storage itself is approximately proportional to retained changed
record payloads. Compression, eviction, checkpoints, and journal files are
explicitly deferred.

## Revision and state identity

`currentRevision` identifies a published runtime transition and only increases.
`currentStateId` identifies persistent document content. They are intentionally
different:

```text
S0 at revision 0
commit -> S1 at revision 1
undo   -> S0 at revision 2
redo   -> S1 at revision 3
```

The initial document receives one opaque state ID and no fake history entry.
Every successful new transaction receives a freshly allocated state ID from the
same opaque, non-recycling allocator used by the Caderact document store. Undo
and Redo restore the entry's pre-existing state IDs. A new edit after Undo
discards only the redo suffix after it has successfully published, then gets a
new state ID; failed, stale, rolled-back, and no-op work preserves Redo.

## Saved-state identity

There is no persistence implementation in A4. The controller nonetheless
exposes `captureStateToken()` and `markStateSaved(token)` so later asynchronous
serialization can pin a particular committed state and acknowledge that exact
state after it succeeds. A token contains the captured `stateId` and revision,
and is also an immutable controller-issued in-memory capability. The controller
keeps its issued token objects privately, so a fabricated object (or a token
from another controller/runtime) is rejected even if its fields happen to
match. This is an A4 in-memory contract, not persistence encoding or
cryptography; a later persistence stage must define a durable acknowledgement
contract deliberately.

`savedStateId` is initially absent. `savedRevision` is retained as a diagnostic
of the acknowledged token only. Cleanliness is identity based:

```text
isDirty = savedStateId is absent || currentStateId !== savedStateId
```

Thus saving S10, editing, and Undoing back to S10 is clean even though the
monotonic runtime revision is newer than `savedRevision`.

## Active edit restriction

Undo and Redo refuse to run with a foreground A3 transaction open, returning
`blocked-by-active-transaction`. They do not forcibly roll back, queue, or
interleave with that draft.

## Transitional Line limitation

Line still uses A3's per-segment transactions. Consequently each accepted
segment currently creates a temporary independent A4 history entry, and the
existing Escape cancellation still creates its own removal transaction. A4 does
not change that behavior. A5 will introduce one private Line draft and one
whole-session transaction/history entry on Enter.

## Deferred work

A4 deliberately does not add A5 Line drafts or step undo, Ctrl+Z/Ctrl+Y input
routing, command management/options, persistence (including files, IndexedDB,
autosave and recovery), history persistence/compression, units, snapping,
collaboration, rendering changes, or the known WebGPU recovery fix.
