# FS3 — Recovery validation and restore safety

FS3 is the trust boundary between untrusted FS2 records and future recovery UX. Merely finding a record never changes the active editor. The required path is envelope validation, exact fingerprint verification, native parsing/migration/validation, isolated preparation, classification, and an explicit application call.

## Envelope and fingerprint validation

Recovery envelope v1 is closed over its required semantic fields: recovery version/key, positive sequence, non-empty string payload, lowercase SHA-256 fingerprint, state ID, nonnegative revision and timestamp, filename/display name, supported source kind, optional manual-save fingerprint, Boolean dirty flag, and positive native persistence version. The UTF-8 payload must not exceed the shared FS2 16 MiB limit. Unknown future envelope versions are `incompatible-version`; malformed v1 metadata is `corrupt-envelope`.

SHA-256 is recomputed over the exact stored payload before JSON parsing or store construction. A mismatch is `fingerprint-mismatch`; it is never rewritten or applied.

## Native validation and classifications

After fingerprint verification, `CaderactPersistence.loadStore` performs the same parse, migration, normalization, document validation, graph/reference checks, topology checks, numeric checks, and resource enforcement as native Open. FS3 adds no relaxed recovery validator. A future native `fileVersion` is `incompatible-version`; malformed JSON or rejected native semantics are `invalid-document`; explicit resource failures are `excessive-resource-rejected`.

The classification vocabulary is:

- `valid-equivalent`: fingerprint equals confirmed manual-save evidence.
- `valid-stale`: a committed save in the same recovery session has a different fingerprint and a revision at least as new as the capture.
- `valid-newer`: the valid dirty capture differs from, or predates the absence of, confirmed manual-save content.
- `valid-unresolved`: valid content whose ordering cannot be proved.
- `corrupt-envelope`, `fingerprint-mismatch`, `invalid-document`, `incompatible-version`, `excessive-resource-rejected`, and `unreadable-storage-failure`: distinct non-applicable outcomes.

Timestamps support deterministic presentation order but never establish semantic newer/stale status by themselves. Initiated downloads and failed saves provide no stale evidence.

## Candidate isolation and application

A valid result contains frozen recovery metadata, a frozen copy of the validated document, and a small safe summary. The isolated validation store is never installed. Prepared-candidate identity is held privately; copied or forged objects cannot be applied.

Explicit application rejects active commands, revalidates the frozen document through `CaderactDocument.createStore`, and only then replaces through `DocumentSession`. The replacement has empty history and intentionally starts dirty. Existing session listeners reconcile selection, grips, tracking, and viewport/document consumers; the viewport uses its established replacement reset.

Recovered file metadata retains the useful filename/display/source label, clears any browser file handle and prior durable-save evidence, and requires a new confirmed Save or Save As to become clean. Recovery is not a manual save.

Document replacement rotates FS2's recovery identity. The recovered dirty document is immediately autosave-eligible, while old-session completions cannot represent the new session. The original recovery record is retained until explicit dismissal or later safe cleanup, so application does not destroy its own source.

## Storage failures, retention, and startup surface

`classifyAll` classifies records independently and sorts by timestamp, sequence, then recovery key for stable newest-first presentation. A corrupt record does not poison valid peers. List/read/fingerprint failures return structured failures without editor mutation.

`dismiss` is the explicit one-record cleanup primitive. Corrupt, incompatible, and valid-newer records are retained by default; delete failures are non-destructive. FS5 may use `classify`, `classifyAll`, `dismiss`, and `apply` to build startup and recovery UI, but FS3 performs no automatic restore or deletion.

## Boundaries

Native schema remains v3. Classification, diagnostics, prepared stores, and UI state remain external runtime data. FS4 may add broader file-safety lifecycle mechanisms; FS5 owns final startup discovery, user choice, and recovery/unsaved-change presentation.
