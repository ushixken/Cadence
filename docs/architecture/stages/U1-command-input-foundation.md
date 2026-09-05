# U1 — Command and input foundation

Status: Completed; ready for review.

## Previous command path

Before U1, `command-input.js` owned a private Line-only definition list and
called Line-specific viewport methods. `Viewport` separately stored an
`activeCommand` string, branched on `"line"` for completion/cancellation and
pointer handling, and emitted prompt events. Autocomplete and execution shared
that one local list, but there was no reusable registration, session, or result
contract. Unknown input produced no structured outcome.

## Registry contract

`CaderactCommandRegistry.createRegistry(definitions)` creates an immutable
registry. A definition contains:

- canonical `name`;
- immutable `aliases`; and
- an `activate(context)` factory.

Canonical names and aliases are unique under trimmed, case-insensitive
normalization. Exact lookup and prefix matching use the same definitions.
Autocomplete receives canonical-name-sorted matches, giving deterministic
ordering independent of registration order.

U1 registers only `Line`, with alias `L`. A unique prefix such as `li` retains
the accepted launch behavior. Ambiguous future prefixes return invalid input
rather than silently selecting a command.

## Router and session lifecycle

`CaderactCommandRouter` owns the active session, active command identity,
current prompt, and last structured result. It starts a definition only while
idle. Attempts to launch another command while a session is active return
`command-active` and leave that session untouched.

An active session supplies at least its canonical `name`, current `prompt`,
`finish()`, and `cancel()`. Optional viewport interaction methods remain owned
by the command session. The router supplies a prompt sink to the activation
factory so session prompt changes have one route to the existing command input.

The result statuses introduced by U1 are:

- `command-started`;
- `command-active`;
- `command-completed`;
- `command-cancelled`;
- `unknown-command`; and
- `invalid-input`, with a reason where applicable.

These are routing/feedback results, not document history.

## Line migration and ownership

The Line registry definition activates a viewport-created Line command session.
That adapter owns prompt and viewport-event coordination while
`LineDraftSession` continues to own points, accepted draft segments, preview,
Step Undo, atomic finish, and cancellation semantics.

The viewport asks the router for the current session and delegates pointer
events through optional session methods. It does not branch on the command name.
`DocumentController` remains the only persistent publication/history owner.

Enter completes active Line through the router; Escape cancels it. While Line
is active, printable global typing does not focus the command input and command
execution cannot replace or restart the active session. Existing Enter, Space,
click, alias, case-insensitive, and unique-prefix launch behavior is preserved.

## Autocomplete and unknown input

Autocomplete calls `registry.matches()` directly, so display and execution
cannot drift into separate command lists. Unknown non-empty input returns the
immutable deterministic shape `{status: "unknown-command", input}` and updates
the existing input hint without changing the document, revision, history, or
state identity.

## Deferred input work

Deferred beyond U1: additional commands, command history HUD, coordinate and
distance parsing, unit suffixes, expressions, localization/IME policy, command
options, Ctrl+Z/Ctrl+Y routing, selection, snapping, toolbar integration, and
user-facing command documentation.
