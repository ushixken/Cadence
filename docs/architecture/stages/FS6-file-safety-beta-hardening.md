# FS6 — File safety and recovery beta hardening

Status: **beta-ready** after the FS1–FS6 completion gates and full regression suite pass.

## Final authority boundaries

- `DocumentController` exclusively owns semantic state identity, history, dirty state, and save tokens.
- `DocumentFileState` owns runtime filename, handle, source, durability, and confirmed-save metadata.
- `CaderactPersistence` owns canonical native v3 serialization, migration, loading, and validation.
- `CaderactRecoveryStorage` owns IndexedDB records, debounce, immutable capture, sequence ordering, and storage failures.
- `CaderactRecoveryValidation` owns untrusted-envelope validation, fingerprinting, classification, candidate authentication, and explicit application.
- `DocumentSession` owns active-store replacement and consumer reconciliation.
- `FileSafetyUx` presents decisions and status only; it does not infer dirty state, parse files, validate recovery, or replace documents.

## Durability, autosave, and recovery contracts

Only a write reported `committed` after durable writer close may acknowledge its exact captured state. `initiated` browser downloads remain dirty and visibly unconfirmed; failed and cancelled operations preserve work and metadata. A late save cannot clean newer edits.

Autosave observes committed semantic history, coalesces with a 1500 ms debounce, skips clean/unchanged states, and never changes dirty state. Monotonic sequences plus atomic compare-before-publish prevent old writes replacing new recovery. Session rotation isolates replacement and recovery races. Autosave failures notify the presentation authority once until a successful autosave clears the warning state; success remains silent.

Recovery remains: raw untrusted record → strict envelope → exact SHA-256 → native v3 load/validation → evidence-based classification → authenticated isolated candidate → explicit Recover. Recovery is never automatic. Successful application resets history, remains dirty, clears unsafe handle/save evidence, rotates autosave identity, resumes autosave, and retains the source record. Failed or forged application leaves active work unchanged.

## UX and destructive operations

Startup recovery presents valid candidates deterministically and reports corrupt/incompatible peers without offering them as recoverable. Recover and Dismiss delegate to FS3. New, Open, DXF Import, and replacement over dirty work use Save/Discard/Cancel. Only committed Save continues automatically; initiated, failed, or cancelled Save does not. Download-only users can explicitly discard after seeing that durability was unconfirmed.

The editor now bootstraps its pristine blank drawing as clean. The generic document-store default remains dirty, preserving low-level safety. Dirty-only `beforeunload` protection therefore avoids a false warning on untouched startup, remains active after edits/autosave/initiated download, and clears only when the exact state is durably saved.

## Native and DXF boundaries

Native Open is gated at 16 MiB and DXF Import at 8 MiB before parsing, with an additional decoded-text check. Exact boundary values proceed to authoritative content validation; one byte over is rejected. Both workflows fully construct isolated stores before centralized replacement.

DXF retains its existing supported subset and parser/graph/entity limits. Export validates and preflights all model and Block content before output; unsupported Region/Hatch and unrepresentable content cannot begin external writing. DXF output uses the same committed/initiated/failed contract and never mutates document identities.

Recovery payloads remain limited to 16 MiB. Native document validators continue to enforce identity, collection, Block graph/depth, Region/Hatch topology, text/dimension, layer/property, and numeric constraints.

## Failure and security guarantees

Injected picker, permission, read, parse, migration, validation, serialization, fingerprint, IndexedDB, quota, write, close, export, delete, and replacement failures leave relevant authorities unchanged. A failed recovery or file operation cannot partially publish a document or silently clear useful recovery.

Extensions are picker hints only. Imported text is never evaluated. File-derived text uses text-only DOM properties. Prototype-sensitive and malformed shapes pass through closed native schemas and shared validation. Runtime paths, renderer caches, fill triangles, previews, selection, grips, tracking, and UI state never enter native JSON or recovery payloads.

## Performance and beta limitations

Pointer movement performs no serialization. Autosave remains debounced and semantic; recovery classification is bounded by candidate payload limits and uses no speculative renderer traversal or caches.

Browser download completion cannot be proven, unload handlers cannot synchronously finish IndexedDB work, and browsers control unload-dialog wording. Recovery remains local to the browser profile. Deferred post-beta work includes cloud/account backup, collaboration, server recovery, version-history browsing, recovery diffs, thumbnails, automatic recovery, new persistence versions, new DXF features, and broad workspace redesign.
