# D3 — Selection Foundation

## Transient ownership and identity

`SelectionManager` owns only a private set of stable committed-record IDs. It never copies geometry, stores renderer indexes, mutates records, or creates A4 history. Its `selectOnly`, `toggle`, `clear`, `has`, `selectedIds`, and `pruneAgainstDocument` operations return immutable sorted snapshots and never expose the mutable Set.

## Pure Line hit testing

`hitTestLines` projects authoritative Line endpoints through the supplied camera transform and computes the nearest point on each finite screen-space segment using a clamped scalar projection. Zero-length Lines reduce to point distance. The tolerance is 8 CSS pixels and is not multiplied by DPR, so zoom changes world tolerance while acquisition remains visually consistent.

The nearest screen-space hit wins. Exact distance ties use lexicographically sorted stable record ID, independent of document insertion or renderer order. Selection cycling is deferred.

## Pointer rules and command arbitration

The viewport owns one ordinary left-pointer dispatcher in addition to navigation's specialized handling. When an active session accepts pointer points, the dispatcher performs the existing D2 snap/command path and returns without hit testing. Otherwise it performs idle selection:

- click hit replaces selection;
- click empty clears;
- Ctrl/Meta click hit toggles membership; and
- Ctrl/Meta click empty preserves selection.

Thus Line and selection never consume the same click. Existing selection remains unchanged during Line, D2 snapping remains active, and idle snapping remains disabled. Finishing or cancelling naturally restores idle selection behavior.

Ctrl+A on Windows/Linux and Cmd+A on macOS replace the current selection with all authoritative committed drawable record IDs (Line, Circle, Arc, Ellipse, and native Polyline). The editor keyboard owner delegates the replacement to `SelectionManager`; identical and empty sets are no-ops. Editable inputs, textareas, selects, contenteditable regions, active commands, grip edits, and pointer-selection interactions retain ownership and are never intercepted.

## Renderer-neutral highlight

`ViewportScene` projects selected IDs against current authoritative records into `selectionOverlay`: sorted IDs and Line segment data. The same segment is appended as a restrained blue, two-unit overlay line group after committed geometry and other transient overlays. Canvas2D and WebGPU receive the same logical geometry; neither decides selection membership or changes persistent style. No endpoint dots, grips, or control points are emitted.

## Reconciliation and sessions

The viewport subscribes to the active controller's history notifications and prunes IDs missing from current authoritative records. Valid selections survive ordinary edits and Undo/Redo. A deleted/undone-away selected object is removed and is not implicitly reselected if later restored.

Every `DocumentSession` replacement clears selection before binding the replacement controller, even if the new project happens to contain an identical ID. New and Open therefore cannot leak old-project selection.

## Performance and deferred work

Hit testing performs a simple deterministic traversal of current supported records only on idle clicks. It is pure and replaceable by future spatial indexing without changing selection identity.

Hover/preselection, grips and editing, pickbox, window/crossing selection, cycling, filters, invert selection, Delete, transforms, Properties, object layer reassignment UI, selection sets, advanced snapping, other geometry types, and 3D selection remain deferred.
