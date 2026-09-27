# UX10 — Command and keyboard hardening

UX10 audits and hardens the existing keyboard authorities without changing CommandRegistry, CommandRouter, Dynamic Input, or CAD command semantics.

## Ownership order

Keyboard events follow this precedence:

1. Active modal dialog or top menu/flyout/context surface.
2. Focused native editable control or contenteditable field.
3. Command input and its autocomplete/options.
4. Dynamic Input field editing.
5. Selection capture/cycling and grip editing.
6. Active command session.
7. Idle selection shortcuts and command typing/repeat.
8. Viewport navigation/modifier state.

Escape therefore closes a field edit or transient surface before affecting an active command, and an active command before idle selection. Enter remains local to editable and modal controls; otherwise it reaches Dynamic Input, selection, or the active command in that order. Space retains the existing tap-to-repeat behavior only while idle and the existing hold/drag navigation behavior.

## Listener audit

- `command-input.js` owns command search, autocomplete, active typed input, idle Select All/Delete, Enter/Escape, and printable command capture.
- `Viewport.js` owns Dynamic Input, selection geometry/cycling, Shift drafting inversion, and the Track acquisition shortcut.
- `ViewportNavigation.js` owns Space navigation and repeat arbitration.
- menu, flyout, context-menu, settings, color, file-safety, and dimension-style surfaces own their local arrows, Enter, Escape, and focus restoration.
- Layers, Groups, Blocks, Properties, and Layout controls retain local editing keys.
- file/history actions retain Ctrl/Cmd application shortcuts outside editable controls.

The hardening guards document-level command and viewport listeners with `defaultPrevented`, modal/transient-surface state, and editable-target ownership. This prevents a local Enter/Escape/Tab from leaking into an underlying command, selection cycle, or Dynamic Input session.

## Shortcut audit

Registry command names and aliases are normalized case-insensitively and verified collision-free. Existing application shortcuts remain limited to their established authorities: Ctrl/Cmd+A, Ctrl/Cmd+K, Ctrl/Cmd+N/O/S, Ctrl/Cmd+Z/Y, Ctrl+Alt+T, command aliases, and Space navigation/repeat. No new shortcut family is introduced.

## Preserved behavior

The changes do not affect point resolution, raw-pointer crosshair placement, Osnap, Track/Extension/OnParallel, Ortho/Polar, command validation, history/dirty state, persistence, Layout/PDF, DXF, or file safety.
