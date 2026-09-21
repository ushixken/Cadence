# FS1 — Safe native save foundation

FS1 establishes runtime file-session metadata and an explicit browser output contract without changing native document format v3 or introducing autosave/recovery state.

## Dirty and save-point authority

`DocumentController` remains the only dirty/save-point authority. A document is dirty when `savedStateId` is absent or differs from `currentStateId`. Revision is monotonic activity metadata and is not used as a dirty flag. Undo can revisit the saved state and become clean; Redo can leave it and become dirty. A save captures a controller-issued token before serialization and may acknowledge only that exact captured state, so an edit made during asynchronous output remains dirty.

## File-session metadata

`CaderactDocumentFileState` owns runtime-only filename/display name, source kind (`untitled`, `native`, or `dxf-import`), an optional browser file handle, the last manual-save SHA-256 fingerprint, last successful-save metadata, and last output durability. It owns no document content or history. File handles and file-session metadata are never serialized into native files.

The same authority performs the dirty-state guard for New, native Open, and replacement-style DXF import. Current confirmation UI is retained for FS1; richer unsaved/recovery UX remains FS5 work.

## Save capture and output contract

The save pipeline is:

1. capture the immutable semantic state token;
2. validate and serialize the complete canonical native payload through `CaderactPersistence`;
3. write that exact payload;
4. classify output as `committed`, `initiated`, or `failed`;
5. acknowledge only a `committed` captured state;
6. update durable filename/handle/fingerprint metadata only after commitment.

`committed` means a durable adapter completed its write and close operations. `initiated` means an anchor/Blob browser download was requested, but disk completion is unknowable. `failed` means serialization, picker, write, close, or adapter validation failed. Initiated and failed outputs leave the document dirty.

Legacy injected test/application adapters that predate the result contract are treated as committed when their returned promise completes; the production browser adapter always returns an explicit durability result.

## Save and Save As

When a durable handle exists, Save writes the captured payload through `createWritable()`, waits for `write()` and `close()`, and then acknowledges. Without a handle, Save uses the Save As selection path where the File System Access API is available. Save As updates the handle and filename only after committed output. Picker cancellation changes nothing.

Browsers without the File System Access API retain the Blob/download fallback. That path reports `save-initiated`, retains the existing durable metadata, and does not mark the document clean. Caderact does not claim that an initiated download reached disk.

SHA-256 is computed over the exact canonical serialized payload. Fingerprint failure is reported in the save result but cannot corrupt the document; a confirmed durable write can still acknowledge its exact captured state with a null fingerprint.

## Replacement lifecycle

Native Open reads, parses, migrates, validates, and constructs an isolated clean store before one replacement. File metadata changes only after successful replacement. New constructs a validated clean blank store and resets metadata. DXF import constructs an isolated store, replaces once, and intentionally remains dirty because reading DXF is not a native manual save.

All three paths share the same replacement helper, which invokes `DocumentSession.replaceStore()` and the existing viewport document-reset authority. New/Open/DXF import remain blocked while a command is active. Save remains permitted and captures committed semantic state only; drafts and previews are excluded.

## Deferred FS work

FS1 adds no IndexedDB records, autosave timers, startup recovery, candidate classification, recovery dialog, or unload warning. FS2 will add bounded recovery storage and autosave coordination; FS3 will classify and validate recovery candidates; FS5 will supply the full recovery and unsaved-change UX.
