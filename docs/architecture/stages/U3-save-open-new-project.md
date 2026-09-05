# U3 — Save / Open / New Project

## Active-document ownership

`DocumentSession` owns exactly one active `CaderactDocument` store. It exposes the current reader, controller, and gateways and publishes atomic store replacements. The viewport rebinds its reader and gateways; U2 history actions unsubscribe from the old controller and subscribe to the new one. There is no mirrored persistent state.

## Native file and Save

Projects use `.caderact`. Their contents remain the strict A8/A11B `fileVersion: 1` JSON envelope; U3 makes no schema or version change.

Save calls `CaderactPersistence.captureSave` before the asynchronous write. That pins the serialized authoritative snapshot and its controller-issued state token. Only a successful write acknowledges that exact token. A later edit therefore remains dirty, failed writes acknowledge nothing, and Undo back to the saved state becomes clean. Line drafts/previews are transient and excluded.

The browser fallback downloads JSON through Blob/object-URL APIs. The adapter boundary permits a later File System Access implementation without putting handles in `CaderactDocument`.

## Open and failure atomicity

Open selects and reads a file, then completely parses and validates it with `CaderactPersistence.loadStore`. Replacement occurs only after success. Cancellation, read errors, malformed JSON, unsupported versions, and invalid v1 schemas leave the current store untouched. The A8 load path preserves and reserves document, layer, record, and topology IDs. A loaded controller is clean with empty history.

## New

New constructs a fresh canonical store with new document/default-layer identities, millimeter units, empty records/history, and an acknowledged clean initial state. It replaces the store without reloading the page.

## Guards and command policy

Dirty New/Open operations require deterministic browser confirmation. Cancel never discards the current store. New and Open are blocked while any command is active, preventing replacement underneath a Line draft. Save remains allowed because it captures committed authoritative state only.

## UI, shortcuts, and rebinding

The existing File menu exposes New, Open…, and Save. `Ctrl+N`, `Ctrl+O`, and `Ctrl+S` route outside command input and other editable controls; browser defaults are prevented only when Caderact handles the shortcut.

After New/Open, the viewport retains its renderer, rebinds to the replacement reader/gateways, resets the camera to the initial centered view, and redraws. History controls rebind to the replacement controller.

Operations return immutable statuses including completed, cancelled, failed, and active-command-blocked variants for later feedback UI.

## Deferred

Autosave, recent projects, persistent browser handles, Save As, IndexedDB, cloud storage, recovery journals, migrations/v2, CAD interchange formats, and custom modal/feedback UI remain deferred.
