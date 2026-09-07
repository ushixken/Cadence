# M5 — Delete / Erase

M5 adds repeatable `Delete` with aliases `DEL`, `E`, and `ERASE`. It is a selection-only Modify command: it reuses D3/D3A click, Window, Crossing, Ctrl/Meta toggle, Enter, quick Space, Escape, and pointer-cleanup behavior without adding any preview or renderer state.

Delete always waits for Enter or quick Space to commit the current selection. An empty selection completes as a history-free no-op. A non-empty selection is removed through one `recordGateway.removeAll` transaction, so all selected native records are deleted atomically. Lines, Circles, Arcs, Ellipses, native Polylines, and Rectangle/Polygon Line collections remain records and are never exploded or converted.

Successful deletion clears selection, adds one history entry, and leaves no stale selected IDs. Undo restores exact records, layers, feature IDs, geometry, ordering, and strict-v1 data; Redo removes those same records again. A failed publication preserves the document and selection so the active command can be retried.

While idle with the canvas focused and outside active grips, Delete and Backspace invoke the same operation for an existing committed selection. Both remain normal text editing keys in editable fields, and active commands retain their own keyboard behavior. No persistence/schema changes, selection-model changes, snapping changes, OOPS/Purge/Delete Duplicate, or Trim integration are included.
