# L6 — Properties Panel

## Sidebar ownership

Properties is a persistent tab in the existing right editor sidebar, alongside Layers. It is not a modal and does not own selection or document state. The selected-record summary and every control are rebuilt from `SelectionManager` and the active `DocumentSession` read side. The C2 selected-object **Properties** action opens and focuses this same panel.

## Selection and mixed values

A single selection shows its native type and a compact read-only geometry summary. Multi-selection shows the common type and count, or `Multiple (n)` for heterogeneous records. Layer and appearance controls aggregate authoritative record values; differing color, linetype, or lineweight is represented with the non-persistent `CaderactObjectProperties.MIXED` sentinel and displayed as **Mixed**.

## Editing

Layer changes reuse the L3 batch assignment authority. Color, linetype, and lineweight changes reuse the L4 `recordGateway.setProperties` transaction, including `ByLayer` as `null`. Each batch edit is one publication and one history entry; exact no-ops remain history-free. Undo and Redo refresh the panel from the resulting document state.

Property editors are disabled while a command owns editing, or if the authoritative selection is not editable. Geometry values are informational only. The panel never edits record identity or geometry.

## Lifecycle

The panel subscribes to selection, command, active-document, and active-controller history changes. Selection changes, deletion, layer visibility/locking reconciliation, Undo/Redo, command completion, and New/Open therefore cannot leave cached property values. Opening, focusing, or switching sidebar tabs does not mutate document, history, revision, dirty state, or persistence.

## Deferred

Advanced geometry editing, coordinates, vertex tables, fills, transparency, materials, custom linetypes, plot styles, and dock/resize behavior remain deferred.
