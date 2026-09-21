# FS4 — Import and export safety hardening

FS4 treats every external file boundary as untrusted while retaining native schema v3 and the existing DXF feature scope. No file content is published until parsing, normalization, validation, and isolated candidate construction have completed.

## Native Open

Native Open follows: picker → metadata size gate → text read → decoded UTF-8 size gate → `CaderactPersistence.loadStore` → canonical fingerprint → centralized `DocumentSession` replacement → file metadata update. The input limit is 16 MiB, shared with recovery payload safety. File extension is only a picker hint and never substitutes for content validation.

Empty, malformed, truncated, wrong-root, incompatible-version, invalid-identity/reference/topology, nonfinite, resource-excessive, and otherwise invalid documents are rejected by the existing persistence and document validators. Picker cancellation is a normal no-op. Picker, permission, read, resource, incompatibility, validation, and replacement failures are structured separately and leave document, history, dirty state, file metadata, recovery identity, selection, and transient editor state untouched.

## Native Save and Save As

The FS1 sequence remains authoritative: capture one immutable semantic state, serialize it completely, write the exact payload, classify output durability, fingerprint it, and acknowledge only the captured state after a committed write. Concurrent edits therefore remain dirty.

Save As cancellation changes no metadata. Permission, writable creation, write, and close failures do not acknowledge or adopt the proposed destination. File System Access writes are `committed` only after `close()` resolves. Blob/download fallback is only `initiated`; browser APIs cannot prove that the user ultimately retained the download.

## DXF import

DXF uses its existing hostile-text parser and centralized limits. File metadata and decoded text are both gated at the authoritative 8 MiB DXF limit before parsing. Group pairs, strings, entities, tables, diagnostics, Block graph depth/cycles, numeric values, transforms, layers/properties, Text, Dimensions, and supported geometry continue through `CaderactDxfParser`, `CaderactDxfImport`, and native document validation.

Only a fully constructed isolated native store can replace the session. Failed reads, parsing, mapping, graph validation, or replacement cannot rotate recovery or mutate active authorities. Successful import resets history, remains intentionally dirty, rotates recovery through the shared session hook, and is autosave-eligible. Region/Hatch DXF interoperability remains unsupported.

## DXF export and output atomicity

`CaderactDxfExport.exportDocument` validates the complete native document and preflights every model-space and Block-definition record before returning output. Unsupported Region/Hatch records, formatting, transforms, references, or invalid internal state fail before the external writer is invoked. Deterministic semantic input retains deterministic DXF generation, and export never mutates native identities or editor state.

Generation atomicity and durable-write atomicity are separate. A complete DXF string must exist before output begins. External output then reports `committed`, `initiated`, or `failed`; the file action no longer treats a resolved but explicitly failed/initiated adapter as durable completion.

## Failure contract and reconciliation

File operations distinguish cancellation, invalid input, incompatible version, resource rejection, unsupported content, permission denial, read failure, write failure, serialization/export failure, initiated output, and committed output. Diagnostics contain bounded messages rather than stack traces.

New, Open, DXF Import, and authenticated recovery application continue to replace through `DocumentSession`; their consumers own selection, grips, tracking, measurement, command-preview, viewport, and history reconciliation. FS4 introduces no competing replacement path.

Failed Open/Import never affect recovery identity or existing candidates. Confirmed native Save cleans only its captured state and may retire only matching recovery. Initiated or failed output retains useful recovery. Successful Open establishes a clean recovery session; successful DXF Import establishes a dirty one.

File-derived names and entity text remain data. UI presentation uses existing text-safe controls, imported content is never evaluated, and DXF text export escapes non-ASCII/control-sensitive characters through the established encoder.

These structured results, durability values, and bounded diagnostics are the FS5-facing surface for recovery and unsaved-change UX.
