# FS5 — Recovery and unsaved-changes UX

FS5 exposes the FS1–FS4 safety authorities through two compact editor dialogs and a restrained save-state label. It adds no alternate dirty logic, persistence parser, recovery validator, or document replacement path.

## Startup recovery

After file/recovery authorities initialize, the UI calls `RecoveryValidation.classifyAll`. With no relevant records, startup proceeds without interruption. Recoverable records are ordered deterministically by FS3 and `valid-newer`/`valid-unresolved` entries are presented before informational corrupt or incompatible records. Nothing is applied automatically.

The dialog shows a text-safe display filename, local timestamp, and plain-language status. Multiple candidates use one keyboard-accessible selector. Internal recovery keys, state IDs, hashes, parser details, and stack traces are never displayed.

Corrupt, fingerprint-mismatched, invalid, incompatible, and resource-rejected entries may be reported and dismissed, but Recover is disabled. Deterministic corruption is described as unsafe rather than repairable.

## Recover and Dismiss

Recover delegates exclusively to FS3's authenticated `apply`. If the current drawing is dirty, the ordinary Save/Discard/Cancel decision is required first. Successful recovery remains dirty, rotates the autosave session, resumes autosave, retains its source recovery record, and tells the user to save. Failure preserves both the active drawing and recovery record.

Dismiss calls FS3's one-record deletion primitive. Success removes only the selected entry; deletion failure keeps it available and reports a concise error.

## Unsaved destructive actions

`DocumentFileState.guardReplacement` remains the dirty authority for New, native Open, and DXF Import. Its UI decision is:

- Save: perform the existing native Save/Save As flow; continue only after `committed` durability.
- Discard: knowingly continue without saving.
- Cancel: retain the current drawing and stop the operation.

An `initiated` download cannot continue automatically because browser download completion is unprovable. Failed or cancelled saves also retain the drawing. The user may retry and explicitly choose Discard, so download-only platforms do not create a destructive loop.

## Save state and errors

The footer label derives its filename from `DocumentFileState` and cleanliness from `DocumentController`. It distinguishes Saved, Unsaved changes, Saving, Save failed, and Download unconfirmed. Background autosave success is silent; an explicit autosave failure surface advises a manual save.

FS4 reasons map to concise messages for corrupt input, incompatible versions, resource limits, unsupported DXF content, permission, read, write, serialization, replacement, and recovery failures. Cancellation normally produces no error or history noise.

## Keyboard, commands, and browser exit

Dialogs use semantic headings, labels, selects, and buttons. Focus enters on a safe action, Tab/Shift+Tab wrap through dialog controls, Escape cancels or closes, and Enter defaults to Cancel in the unsaved-work dialog. Focus returns to the previously active control on close.

Recovery remains blocked by FS3 while a command is active. Successful replacement uses `DocumentSession`, whose existing consumers reconcile previews, selection, grips, tracking, measurements, viewport state, and history.

`beforeunload` requests the browser's standard warning only while `DocumentController.isDirty` is true. It does not attempt autosave, promise custom wording, or run synchronous IndexedDB work.

## Deferred UX0 and FS6 work

FS5 does not add thumbnails, recovery diffs, version browsing, cloud sync, workspace customization, or a general status-system redesign. FS6 may harden beta lifecycle edge cases and presentation, while broader UX0 remains separate.
