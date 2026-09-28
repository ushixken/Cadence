# UX12 — Professional feedback system

## Routing authority

Caderact separates feedback by interaction ownership:

- Command phase instructions, correctable command input, completion history, and
  command cancellation remain owned by `CommandFeedback`.
- Field-level validation remains beside or within the owning editor or dialog.
- General application results use `CaderactApplicationFeedback`.
- Persistent decisions and destructive choices use the UX11 dialog contract.
- Unsaved changes, recovery candidates, and recovery failures remain owned by
  `FileSafetyUx`.

This prevents application results from temporarily replacing an active CAD
command instruction. No feedback authority owns document, history, dirty, or
persistence state.

## Application notifications

`CaderactApplicationFeedback` owns at most three transient entries. Entries have
stable IDs, deterministic timers and explicit dismissal. Status, success,
warning, and error severities use visible text labels as well as semantic theme
colors. Status-like entries use `role=status`; errors use `role=alert`.
Notifications never take focus. An optional action is supported only through an
explicit label and callback.

The fixed stack stays within viewport margins above the bottom command/status
area and uses compact semantic surfaces in both UI themes. DXF exchange, PDF
export/preview, and Layers/Groups/Blocks management use this application-level
path. Command prompts and file-safety decisions are not duplicated there.

## Confirmation audit

Native unsaved-document replacement remains the meaningful destructive case and
continues through `FileSafetyUx`. Undoable Layers, Groups, and Blocks operations
do not gain confirmation prompts. The legacy browser confirmation adapter remains
only as a fallback behind the established unsaved-changes resolver.
