# U5A — Repeat Last Command / Space Tap vs Hold

## Scope

U5A adds repeat-last-command behavior without changing command implementations, document state, history, persistence, or viewport navigation semantics.

## Repeatable command contract

Command definitions carry an explicit `repeatable` flag. The current drawing commands—Line, Rectangle, Polyline, and Circle—are repeatable. File and history actions remain non-repeatable and do not replace or clear the remembered drawing command.

The command router stores the canonical command name only after a repeatable command has activated successfully. Aliases and autocomplete therefore resolve to the same identity: for example, `Rect` remembers `Rectangle`, while `PL` and `Pline` remember `Polyline`.

Repeating uses the normal router activation path. It creates a fresh command session with the command's ordinary prompt, completion, cancellation, and transaction behavior. The remembered name is transient editor state and is never included in the document, history, or persistence schema.

## Space interaction state

Viewport navigation owns one explicit Space interaction at a time. Its transient state records whether Space is down and whether the interaction was consumed by navigation, crossed the hold threshold, or used modifier keys.

- A quick, unmodified Space press and release while the pointer is over the drawing canvas repeats the last repeatable command.
- Holding Space for **220 ms** establishes navigation intent. Releasing it does not repeat a command.
- Starting a Space + left-button pan or Ctrl+Space + left-button drag-zoom consumes the interaction immediately. Releasing Space does not repeat a command, even when the drag itself is very short.
- Browser key-repeat events are ignored, so one physical tap can launch at most one command.
- Window blur, disposal, and renderer recovery clear pending Space timers and interaction state.

The threshold distinguishes a deliberate tap from holding Space in preparation for navigation; pointer-down consumption remains authoritative even before the threshold expires.

## Input priority

Editable fields keep their native Space behavior. The command input's existing typed-command selection behavior runs before viewport handling and is unchanged.

An active command also has priority. Space does not replace, finish, or restart an active drawing session. Once that command completes or is cancelled, a later eligible Space tap may launch the remembered command as a fresh session.

Escape cancels through the existing router lifecycle and leaves the repeat identity intact. Undo, Redo, New, Open, and Save do not become repeat targets and do not alter the remembered drawing command.

## Deferred behavior

This stage does not add Enter-to-repeat, command history cycling, repeat counts, user-configurable hold timing, persistent preferences, or a new navigation mode.
