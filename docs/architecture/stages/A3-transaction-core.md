# A3 — Transaction Core

Introduces Caderact's Document Controller and transaction core as the sole
publication gate for persistent document mutations. This is transitional
architecture: it does not yet implement history/undo (A4) or the final
whole-session Line draft (A5).

Target transitional flow:

```
Line
  ↓
short transitional transaction
  ↓
Document Controller
  ↓
candidate validation
  ↓
atomic publication
  ↓
Committed Document
  ↓
Renderer
```

## Controller ownership

`src/js/document/DocumentController.js` owns:

- the current committed document state (via a caller-supplied `getDocument`/`onPublish` pair)
- the monotonically increasing runtime revision
- the single foreground editing lease
- transaction creation and publication
- the candidate validation boundary (delegates to the caller-supplied `validate`, still A2's `CaderactDocument.validateDocument`)

It does **not** own renderer behavior, GPU data, command parsing, persistence,
selection, undo/redo history, or geometry solving. It is schema-agnostic: it
manages one flat table of records keyed by stable record ID, and asks the
caller (`CaderactDocument.js`) to assemble that table back into a full document
via `assembleDocument(baseDocument, objects)` and to freeze the result via the
existing recursive `freeze`.

## Revision semantics

`documentController.currentRevision` starts at `0`. A transaction captures
`baseRevision = currentRevision` at `beginTransaction()`. A successful
non-no-op `publish()` increments the revision exactly once. A transaction
whose `baseRevision` no longer matches the controller's current revision at
publish time is rejected with `{ status: "stale", baseRevision, currentRevision }`
and never touches committed state. No `stateId`, `savedStateId`, dirty state,
or history is implemented — that is A4 scope.

## Edit lease

Exactly one foreground transaction may be open at a time. A normal
`beginTransaction()` call while one is already open throws
`"Finish or cancel the current command"` (ADR-001 §5's rejection wording),
rather than silently queuing the new edit. The lease is released on every
terminal outcome: successful publish, no-op, rollback, validation failure, or
a stale terminal outcome. A closed transaction can never release a lease it no
longer holds — if a second transaction has since begun, the first transaction's
lease-check (`ownsLease()`) is `false` and its terminal calls become no-ops
with respect to the lease, in addition to the fact that calling any method
again after `closed` throws before that check is even reached.

### Testing stale transactions without weakening the lease

Because the lease correctly refuses a second foreground transaction, tests
cannot normally open a second transaction to advance the revision while the
first is still pending. `createController(deps, testHooks)` accepts an
**optional second argument**: a plain object owned by the caller. When
supplied, the controller populates it with `testHooks.forcePublish(objects)`,
which commits a new document state and bumps the revision directly, bypassing
`beginTransaction()`/the lease entirely, tied to that specific controller
instance's own revision/document closure.

Production code never supplies this argument.
`CaderactDocument.js`'s `createStore()` calls
`DocumentController.createController({ ...deps })` with a single argument, so
the app's real controller has no `testing` property and no other reachable
path to a bypass — there is nothing to opt out of at the production call site,
because the capability is never created there in the first place.

`tests/document/transaction.test.cjs` gets its stale-revision scenarios from a
small test-only fixture (`testableController`) that builds its own private
document/controller pair — reusing `CaderactDocument.validateDocument` so
candidates are validated exactly as production does — and passes its own
`testHooks` object as the second argument. This is a genuinely separate
document, not the shared app instance, so there is no route from ordinary
application code to `forcePublish`. A dedicated test
(`'the production document controller exposes no testing bypass'`) asserts
`documentController.testing` is `undefined` and that `'testing' in
documentController` is `false` for the app's real controller.

## Change builder and staged reads

Each transaction exposes `read(recordId)`, `create(recordId, record)`,
`replace(recordId, record)`, and `remove(recordId)`. `read` returns the
transaction's own staged value if one exists, otherwise the committed base
value (or `null` if the record does not exist). Callers never supply a
"before" value — `before` is always derived internally from the committed
base (or, for a record already staged once in this transaction, from that
transaction's own first-seen `before`), so it cannot be forged.

`create` and `replace` are meaningful against the transaction's **current
staged view** (`read`), not just the committed table:

- `create(id, record)` throws unless `id` is currently **absent** from the
  staged view (i.e. `read(id) === null`) — this catches both "already exists
  in committed state" and "already created earlier in this same
  transaction."
- `replace(id, record)` throws unless `id` currently **exists** in the staged
  view (`read(id) !== null`) — this catches replacing something that was
  never committed and never created earlier in this transaction.
- `remove(id)` has no existence precondition. Removing an ID that is absent
  from the staged view stages `null -> null`, which `coalesce()` already
  drops as a no-op (via `recordsEqual`). Remove is therefore idempotent and
  deterministic: a transaction that only removes already-absent records
  simply publishes as an ordinary `{ status: "no-op" }`, with no new outcome
  state introduced.

These preconditions still allow the standard coalescing flows, since after
the first call the staged view reflects the record's existence for the
second: `create` then `replace` nets to `null -> final`, and a committed
record's `replace` then `replace` again nets to `original committed ->
final`.

## Change-set format and absence representation

A successful transaction's `changes` array contains
`{ recordId, before, after }` entries. Absence is represented as `null`,
never `undefined`, so it survives `JSON.stringify`/`JSON.parse` unambiguously:

- **Create:** `before = null`, `after = ` the exact created record.
- **Replace:** `before = ` the exact original record, `after = ` the exact final record.
- **Remove:** `before = ` the exact original record, `after = null`.

## Coalescing

Multiple staged operations on the same record within one transaction collapse
to their net result before validation/publication:

- create → replace = `null → final record`
- replace → replace = `original committed record → final record`
- create → remove = no-op (both sides are `null`, filtered out)
- replace → remove = `original committed record → null`
- any change whose final staged value is structurally identical to the
  original authoritative value is also treated as a no-op, even without an
  explicit remove (checked via a recursive `recordsEqual`, not reference
  equality)

A transaction whose coalesced change set is empty publishes as
`{ status: "no-op", changes: [] }`: it does not touch committed state, does
not increment the revision, and still closes and releases the lease.

## Atomic publication

`publish()` follows this order: confirm the transaction is open, confirm it
still holds the lease, confirm `baseRevision` still matches the current
revision, coalesce, detect no-op, build the candidate record table, assemble
the candidate document, validate it with A2's existing validator, and only
then atomically switch the committed `state` reference and increment the
revision. The synchronous critical section (`onPublish(freeze(candidate));
revision += 1`) contains no `await`, solver work, persistence writes,
renderer calls, or callbacks into arbitrary external code — readers observe
either the old or the new committed document, never a partial one. Renderer
failures happen strictly after publication and cannot roll back a
successfully committed transaction.

## Stale behavior

A transaction whose base revision has fallen behind (because another
transaction — or, in tests, `testing.forcePublish`) published in the meantime
returns `{ status: "stale", baseRevision, currentRevision }` and leaves
committed state completely untouched. There is no silent rebase or merge.

## Rollback

`rollback()` before publication discards all staged work, leaves the
committed document and revision unchanged, closes the transaction, and
releases the lease. Any further call on a closed transaction (`create`,
`replace`, `remove`, `read`, `publish`, or a second `rollback`) throws
`"Transaction is already closed"` rather than silently doing nothing or
mutating anything.

## Structured outcomes

`publish()` returns one of: `committed`, `no-op`, `stale`, or
`validation-failed`. `rollback()` returns `rolled-back`. Ordinary transaction
control flow never requires parsing a thrown error's message. At A3 completion,
`CaderactDocument.js`'s `legacyLineWriter` converted a `validation-failed` outcome into a thrown
`Error` at that specific call site (preserving the exact pre-A3 behavior the
Stage 2 tests already assert on, e.g. matching `/finite point/`), but that is
a choice made by that transitional caller, not something the controller
itself requires. Programming/invariant violations (e.g. publishing without
the lease, or operating on an already-closed transaction) still throw.

## Transitional Line integration

At A3 completion, `CaderactDocument.js`'s
`legacyLineWriter.add`/`remove` routed through the controller instead of
hand-rolling their own `publish`:

- `add(start, end)` opens one transaction, stages a single `create`, and
  publishes it immediately — so, as before A3, each accepted Line segment
  becomes its own short, immediately-committed transaction (an A–B–C session
  still produces multiple committed writes, not one).
- `remove(ids)` opens one transaction, stages a `remove` for every ID in the
  session (e.g. on Escape), and publishes them together atomically.

A5 subsequently replaced this transitional writer with command-local Line
drafts and one final `recordGateway.createAll()` publication.

This is explicitly **not** A5's final design of one whole-session private
draft published by a single transaction on Enter — that migration is deferred
until Line's session logic itself is rewritten. The viewport's call sites and
observable UX (segment-by-segment persistence, Escape truncating only the
current session's segments) are unchanged from A2.

## Known O(N) behavior

Publication still rebuilds the entire `geometry.objects` table
(`{ ...baseObjects, ... }`) and revalidates the whole candidate document on
every transaction, exactly as A2's `legacyLineWriter` did. This remains O(N)
in total document size per transaction and is not redesigned in A3; large-drawing
scalability is not claimed.

## Deferred to A4/A5

Explicitly not implemented here: `stateId`, `savedStateId`, dirty-state
tracking, undo/redo history, redo branching, the final whole-session Line
draft, collaboration/CRDT behavior, and any persistence layer. The known
WebGPU → Canvas2D same-canvas recovery defect and its regression test were
unchanged at A3; A11 later fixed the canvas lifecycle.
