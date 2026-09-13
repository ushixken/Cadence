# C2 — Context Menu Foundation

## Status

Implemented. C2 adds one reusable, semantic context-menu controller and thin canvas and Layers-panel adapters. It does not introduce a second command, selection, layer, document, or history authority.

## Ownership and routing

`ContextMenu.js` owns only transient menu state, accessible keyboard navigation, focus restoration, viewport clamping, and dismissal. `context-menu.js` derives the current semantic context and routes actions through the existing authorities:

- geometry selection and hit testing use `SelectionManager` through the Viewport;
- Move, Copy, Rotate, Scale, Mirror, Delete, and Repeat use `CommandRouter`;
- Select All uses the Viewport's authoritative committed-record selection path;
- layer actions use the existing Layers-panel and document gateways.

Opening, navigating, or dismissing a menu never mutates document state, history, revision, or dirty state. An invoked action retains its existing transaction semantics.

## Context rules

- Right-clicking selected editable geometry preserves the complete selection.
- Right-clicking unselected editable geometry replaces the selection with that record.
- Right-clicking empty canvas preserves selection and opens canvas actions.
- Locked geometry is not selected and falls back to the canvas context. Hidden geometry cannot be hit.
- A layer-row menu targets that row without making it current implicitly.
- Active commands suppress custom canvas and layer menus. Editable controls retain native browser context-menu behavior.

## Accessibility and lifecycle

The fixed overlay uses `menu`, `menuitem`, and `separator` semantics. Opening focuses the first enabled item. Arrow keys, Home/End, Enter/Space, and Escape are supported; Escape restores focus to the invoking surface. The menu is clamped to the viewport and closes after an action, outside pointer input, blur, command-state change, document replacement, or another menu open.

## Deferred work

Zoom Extents is intentionally absent until an authoritative implementation exists. Advanced nested menus, shortcuts displayed beside actions, and additional record-specific operations remain future work.
