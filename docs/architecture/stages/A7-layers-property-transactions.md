# A7 — Layers and property transactions

Status: Completed; ready for review.

## Purpose and ownership

A7 extends the document transaction boundary from the geometry record table to
the layer table. `CaderactDocument` remains the sole owner of persistent records
and layers. `DocumentController` remains schema-agnostic and owns atomic
publication, revision, history, and state identity. `ViewportScene` continues
to project authoritative records, and renderers continue to own graphics only.

This stage adds no Layers panel or visible layer styling.

## Layer schema and invariants

The document now explicitly stores `defaultLayerId` alongside `currentLayerId`.
Both must resolve to entries in the layer table. Exactly one layer is designated
as the default by `defaultLayerId`, and that layer cannot be removed.

A layer retains the existing small schema:

- `id`: opaque, stable, non-recycled identity;
- `name`: its user-facing name; and
- `visible` and `locked`: pre-existing schema fields retained for compatibility.

A7 does not expose visibility or locking behavior. New layers receive `true`
and `false` respectively. Every persistent drawable record must reference an
existing layer.

Layer names are trimmed before storage, must be non-empty, and are unique under
a case-insensitive comparison. Therefore `Model`, ` model `, and `MODEL` have
the same effective name. Renaming a layer to that same effective name is a
no-op, including case-only changes.

## Transaction and property API

The controller now supports named transactional collections through
`readIn`, `createIn`, `replaceIn`, and `removeIn`. Existing record-oriented
`read`, `create`, `replace`, and `remove` methods remain compatibility wrappers
for the `records` collection. One transaction may contain changes from more
than one collection, and the entire candidate document is validated before one
atomic publication.

`layerGateway` provides the command-agnostic layer operations `create`,
`rename`, and `remove`. `recordGateway` adds `replace`, `updateProperties`, and
`setLayer`. The property update is deliberately a shallow record replacement,
not a generic property or reflection framework. It preserves the record ID;
normal document validation rejects invalid resulting records.

Each successful non-no-op edit creates exactly one publication, revision
increment, state transition, and history entry. Invalid, failed, stale,
rolled-back, and no-op edits do not partially publish. A stale test-fixture
revision advance remains diagnostic and is not itself an application edit.

## Deletion and reassignment policy

- Deleting the default layer is rejected.
- Deleting an existing unused non-default layer succeeds.
- Deleting a layer referenced by any object is rejected without mutation.
- Deleting an already-missing layer reports `unknown-layer` without mutation.
- Assigning an object to an unknown layer reports `unknown-layer` without
  opening a transaction.
- Object reassignment replaces the authoritative record in one transaction.

Objects are never silently moved during layer deletion. Changing `layerId` has
no visual effect yet because layer styling is outside A7.

## History and read side

A4 history entries now identify both the changed collection and stable item ID,
then retain exact immutable before/after values. Undo and Redo restore layer
creation, rename, deletion, object reassignment, layer IDs, record IDs, names,
and references without reallocating identities. Successful edits after Undo
retain A4's linear branching behavior.

`modelReader.layers()` returns a fresh frozen array sorted by stable layer ID;
the layer records are themselves frozen. `modelReader.layer(id)` returns the
immutable authoritative layer or `null`. Snapshot access remains deeply frozen.
Rendering still reads only `modelReader.records()`, so renderers do not acquire
layer ownership.

## Deferred work

A7 deliberately defers Layers UI, active-layer commands, visibility/lock/freeze
behavior, colors, linetypes, lineweights, plot styles, nested layers, selection,
snapping, persistence, DXF, new drawing commands, renderer redesign, and global
Undo/Redo bindings.

