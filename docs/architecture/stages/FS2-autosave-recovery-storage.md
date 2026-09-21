# FS2 — Autosave and recovery storage

FS2 adds durable browser-local recovery capture without adding recovery UI or changing native document format v3. `DocumentController` remains the dirty/save-state authority, `CaderactPersistence` remains the only semantic serializer, and `DocumentFileState` remains the runtime file metadata authority.

## Recovery authority and envelope

`CaderactRecoveryStorage` owns IndexedDB access and the autosave coordinator. Database `caderact-recovery`, version 1, contains the `recoveries` object store keyed by `recoveryKey`. IndexedDB operations are hidden behind `open`, `put`, `get`, `list`, `delete`, `clearSession`, and `close`; raw reads never load or replace the active document.

Recovery envelope version 1 contains a stable random session key, monotonic sequence, canonical native payload, SHA-256 payload fingerprint, captured state ID and revision, timestamp, filename/display name, source kind, last manual-save fingerprint, capture dirty status, and native persistence version. The embedded payload is ordinary native v3 JSON. Recovery metadata is never injected into that JSON or saved in CAD files.

## Trigger and capture policy

The coordinator observes `DocumentController.subscribeHistory`, so successful transactions and Undo/Redo schedule capture while drafts, previews, selection, grips, tracking state, renderer state, caches, and runtime Block paths do not. Dirty changes are coalesced with a conservative 1500 ms beta debounce. Tests and later lifecycle work may invoke `flush()` deterministically.

Each autosave synchronously snapshots the authoritative reader and its state identity, serializes through `CaderactPersistence`, fingerprints the exact serialized bytes, and writes only the captured state. Autosave never calls `markStateSaved` and cannot alter dirty state, history, revision, or selection. Clean or already-stored states are skipped rather than rewritten.

## Ordering and replacement lifecycle

Each recovery session has a random identity unrelated to filename or revision. Ordinary edits and manual saves retain it. Successful New, native Open, DXF import, or another `DocumentSession` replacement rotates it and resets its sequence. New and native Open begin clean and therefore create no redundant recovery write; imported DXF remains dirty and is eligible.

Every record carries a monotonic sequence. IndexedDB performs read/compare/write in one read-write transaction, so a late older operation cannot replace a newer record. Completion also checks the captured session key, preventing a write started in a replaced document from being reported as protection for the new session.

## Manual saves and failures

A confirmed `committed` native save may delete a recovery only when it matches the saved state and the controller has no newer dirty state. `initiated` downloads and failed saves preserve recovery. Recovery read/delete failures never change the successful manual-save result.

Unavailable IndexedDB, open/transaction/quota/read/delete/write errors, serialization errors, fingerprint errors, verification failures, and oversized payloads produce structured recovery failure results. They do not mutate or clean the document and do not delete a previous valid record. Failures are retained on the recovery coordinator for later FS5 presentation rather than sent repeatedly through normal command feedback.

Recovery payloads are limited to 16 MiB in FS2. This guards browser resources without traversing renderer data; valid Groups, Blocks, Regions, Hatches, Text, and Dimensions remain ordinary semantic native content.

## Browser lifetime and FS3 surface

`stop`, `clear`, and storage `close` are explicit cleanup primitives. The implementation does not promise synchronous IndexedDB completion during `beforeunload`; browsers may terminate pending work, so protection comes from debounced writes during the editing session.

FS3 can call `get`/`list` to classify envelopes using their versions, fingerprints, metadata, and raw native payloads. FS2 deliberately performs no automatic restore and presents no recovery UI.
