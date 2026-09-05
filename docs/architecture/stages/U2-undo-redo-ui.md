# U2 — Undo/Redo UI and shortcuts

Status: Completed; ready for review.

## Shortcut mapping

- `Ctrl+Z` or `Meta+Z`: Undo.
- `Ctrl+Y` or `Meta+Y`: Redo.
- `Ctrl+Shift+Z` or `Meta+Shift+Z`: Redo.

Only one primary modifier is accepted. The global handler ignores command input,
ordinary input, textarea, select, and contenteditable targets so native text
editing remains available. An idle unavailable document action is reported but
does not prevent the browser default. Completed actions and active-command
routing consume the shortcut.

## Active-command rule

The U1 active session receives Undo-like input first. Line exposes its existing
`stepUndo()` operation, so Ctrl+Z removes only the latest accepted draft segment.
It does not touch the document, history cursor, revision, state identity, or
saved-state marker.

If Line has no draft segment to step back, Undo is command-scoped unavailable
and remains consumed; it does not fall through to document Undo. An active
command without a Step Undo handler returns `undo-blocked-active-command`.
Redo is always `redo-blocked-active-command` while a command is active. Escape
continues to cancel Line normally.

## Document history and rendering

When idle, U2 calls the existing `DocumentController.undo()` and `redo()` APIs.
No command is rerun and no inverse geometry is solved. A successful traversal
requests a viewport redraw from the new authoritative snapshot.

`DocumentController.subscribeHistory()` is a notification boundary, not another
history store. It fires after successful non-no-op publication, Undo, or Redo.
Listener errors are isolated after publication and cannot roll back document
state. `CommandRouter.subscribe()` similarly reports routing lifecycle changes.

## UI controls and availability

Two compact Undo and Redo buttons sit in the existing top menu bar after the
menu list. They use the established menu colors, dimensions, hover convention,
and disabled opacity.

Every refresh reads `DocumentController.canUndo`,
`DocumentController.canRedo`, and `CommandRouter.isActive` directly. No local
availability booleans exist. Both buttons are disabled while a command is
active; otherwise they track the exact A4 history cursor, including Redo branch
discard after Undo followed by a new edit.

## Result contract

`window.caderactHistory.lastResult` exposes the latest immutable routing result.
Statuses are:

- `undo-completed` / `redo-completed`;
- `undo-unavailable` / `redo-unavailable`;
- `undo-blocked-active-command` / `redo-blocked-active-command`; and
- `undo-blocked` / `redo-blocked` for another controller refusal.

Completed results identify `scope` as `document` or `command` and retain the
underlying immutable controller/session outcome for later feedback UI.

## Deferred history UI

Deferred beyond U2: history panel/dropdown, action labels, multi-step traversal,
command-history HUD, save/open integration, history persistence, user-triggered
renderer recovery, and additional command-specific Undo policies.
