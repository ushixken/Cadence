# Stage 2 — Document + stable IDs

The viewport creates one store through `CaderactDocument.createStore()`, whose
closure owns the current document. At A2 completion,
`window.caderactDocument` exposed `snapshot()` and `lines()` as frozen
read-only data, with no second writable geometry array. A6 later added the
command-agnostic `records()` rendering view while preserving that single-owner
boundary.

## Schema version 1

- Document: `id`, `name`, `formatVersion`, `geometry.objects`, `layers`, `currentLayerId`.
- Object table: keyed by object ID, currently only Line records.
- Line: `id`, `type: "line"`, `layerId`, `start`, `end`.
- Each endpoint: `x`, `y`, `featureId`. The feature ID—not the property position—is its identity. Future reversal must carry the feature ID with its endpoint.
- Default layer: stable `id`, `name: "Default"`, `visible: true`, `locked: false`.

A7 later added an explicit `defaultLayerId` invariant and transactional layer
operations; the description above records the schema as it existed at A2.

Coordinates are JavaScript Numbers in world space. Endpoints are copied on insertion, so pointer state cannot mutate model records. No screen-space, preview, or renderer buffers enter the document. Zero-length segments remain allowed to preserve existing behavior; validation is structural, not a geometry solver.

IDs use 128 random bits from Web Crypto, encoded as opaque strings. A store retains allocated IDs after removal and checks collisions before allocation. IDs are unrelated to coordinates, render positions, or collection ordering. Records retain their IDs on reads; cancelled IDs are not intentionally recycled. No ID rewriting policy or Undo implementation is introduced.

A10 later formalized object and endpoint references using these existing record
and feature IDs; it did not add replacement endpoint identities.

## Temporary compatibility path

Before: pointer clicks → `completedLines.push` → scene projection; Escape truncated a suffix.

After: pointer clicks → private `legacyLineWriter.add` → validated frozen document → read-only Line enumeration → unchanged scene projection.

The viewport retains only the IDs created in the active session. Escape calls the writer's `remove` with those IDs; Enter clears session state without removing records. Segments still become authoritative immediately after each accepted second point. They are **not staged transaction drafts**.

The writer capability is explicitly temporary and held by viewport code, not exported on the active document reader. The factory can create independent stores for isolation; it does not grant access to the active store's writer. This is an application ownership boundary, not a JavaScript security sandbox.

Validation is deterministic and returns errors without modifying its input. It checks document version, tables, key/ID consistency, unique identities across document/layers/objects/features, finite endpoint coordinates, supported type, layer fields, and resolving layer references. Invalid writes leave the current state unchanged. Duplicate JSON keys already discarded by a JSON parser cannot be detected here; a later file loader must address serialized-input validation.

## Tests and scope

The existing 40 Stage 1 cases retain their behavior assertions. Only reads of the removed array were adapted to the new reader, projecting endpoint coordinates where tests compare the old geometry shape. Additional tests cover stable identities, cancellation, deep read-only access, ordering, coordinate precision, input alias isolation, and validation failures.

No renderer, command-input, navigation, crosshair, transaction, history, or visible layer functionality was added or redesigned. The known WebGPU recovery defect and its regression remain unchanged. Tests use the existing VM/browser-stub harness; real browser visual/GPU verification is not claimed.

## Before Stage 3

- Replace the legacy writer with the ADR mutation controller; do not let new tools expand this temporary API.
- Freezing is not the final transaction architecture. Each write currently copies the object table and validates the document, O(N); it is deliberately not a million-object storage solution.
- Explicit ordering and topology correspondence will be needed for later composite/modify tools. Current enumeration preserves creation order but does not define identity.
- Future exact restore must accept validated original records and their IDs rather than call the new-Line allocator. No restore API or history is implemented now.
- Units (added later by A9), revision/saved-state semantics and layers beyond the minimal default remain future work at A2.
