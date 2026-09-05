# A8 — Persistence baseline

Status: Completed; ready for review.

## Purpose and ownership

A8 introduces a deterministic, versioned JSON persistence boundary for the
authoritative Caderact document. `CaderactDocument` still owns live durable
content, `DocumentController` still owns runtime transactions and history, and
`CaderactPersistence` alone translates between a durable snapshot and the file
representation. The viewport, scene projection, and renderers have no
persistence responsibilities.

This is an engine-level format and API. It does not provide Save/Open UI or
browser file access.

## File format version 1

The top-level JSON object contains:

- `fileVersion: 1`; and
- `document`, containing `id`, `name`, `formatVersion`, `defaultLayerId`,
  `currentLayerId`, a `layers` array, and a `records` array.

A9 later completed the initial version-1 document payload with the required
`units: { length }` singleton. Files produced by the current v1 encoder include
it; A8-only prototype payloads without it are rejected rather than migrated.

Each layer persists its stable `id`, `name`, `visible`, and `locked` fields.
Each current Line record persists its stable object ID, type, layer reference,
coordinates, and both stable endpoint feature IDs. JavaScript Number values use
JSON's numeric representation; non-finite values are rejected by document
validation.

The file does not contain controller revision, state IDs, save capabilities,
history entries/cursor, Line drafts, previews, command state, viewport camera,
pan/zoom, renderer resources, or GPU state.

## Determinism and duplicate detection

Layers and records are serialized as arrays sorted by stable ID. Property order
is explicitly constructed by the encoder rather than inherited from document
table insertion order. Serializing the same durable snapshot therefore produces
the same JSON string.

Arrays are intentional at the file boundary: duplicate layer or record IDs can
be detected before reconstructing keyed document tables. The complete candidate
then passes `CaderactDocument.validateDocument`, which also detects identity
collisions across document/layers/records/features, duplicate effective layer
names, broken layer references, malformed fields, non-finite coordinates, and
unsupported record types.

## API

`CaderactPersistence` exposes:

- `serializeDocument(document)` — validate and encode one durable snapshot;
- `deserializeDocument(json)` — parse, version-check, reconstruct, and validate
  durable content;
- `captureSave(reader, controller)` — synchronously capture a controller-issued
  state token and serialize the matching reader snapshot, returning an
  `acknowledge()` capability; and
- `loadStore(json)` — validate the entire payload and create a fresh document
  store from its exact durable content.

The save acknowledgment is runtime-only and never enters JSON. If editing
advances the document while an older snapshot is being written, acknowledging
that older token records that older state as saved; the newer current state
correctly remains dirty.

## Load atomicity and runtime state

Parsing and complete validation happen before a loaded store is created. Invalid
JSON, unsupported file versions, missing fields, duplicate IDs, invalid default
layers or references, malformed records, and unsupported record types throw a
deterministic `Invalid Caderact file` error. They cannot mutate the active store.

A successful load creates a new store rather than replaying edits into the old
one. Durable document, layer, object, and feature IDs are retained exactly and
reserved by the new store's non-recycling allocator. Runtime state is new:

- revision is `0`;
- history is empty and Undo/Redo are unavailable;
- `currentStateId` is freshly allocated and is not read from disk; and
- `savedStateId` equals that fresh current state, so the loaded file is clean.

The caller may install the returned store as the application's active document
in a future Open workflow. A8 intentionally provides no UI/store-swap command.
A6 scene construction can already consume the loaded store's authoritative
`reader.records()` output.

## Compatibility policy

A8 accepts only exact `fileVersion: 1`. Unknown versions are rejected; there is
no guessing, partial import, or migration fallback. `document.formatVersion`
is independently validated by the document schema. Future versions must add an
explicit migration policy before acceptance.

## Deferred work

Deferred beyond A8: Save/Open UI, file pickers, active-store swapping commands,
autosave, recent files, IndexedDB, cloud synchronization, recovery journals,
compression, binary formats, DXF, and A9+ features. Units were added later by
A9 without changing the still-initial file version.
