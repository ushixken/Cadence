# L1 — Layer Manager Foundation

## Ownership and identity

L1 builds on A7 and U6 without adding another layer store. `CaderactDocument`
owns the authoritative layer table, `defaultLayerId`, and `currentLayerId`.
Layer IDs are opaque stable document identities; names are presentation and are
never used as references. Every committed drawable record carries a resolving
`layerId`. The existing v1 persistence schema stores layers, both layer-setting
IDs, and geometry references without a file-version change.

The canonical fresh document contains one `{ name: "Default", visible: true,
locked: false }` layer, and both setting IDs reference it. Strict validation
requires both IDs and every geometry reference to resolve. Invalid persisted
documents are rejected safely rather than installed as partial runtime state.
The default layer remains the guaranteed fallback and cannot be deleted.

## Panel workflow

The existing right-side Layers panel is a read-only projection of the current
document plus small transactional actions. A current-row marker and
`aria-current` expose the active layer. Clicking a normal row makes it current
without selecting or moving geometry.

The `+` action chooses the first case-insensitively unused `Layer N` name,
appends the fresh stable layer under the existing stable-ID ordering policy,
and makes it current in the same transaction. Names are trimmed, limited to
128 characters, reject control characters, and remain case-insensitively
unique. Inline rename preserves the layer ID and ordering; Enter publishes and
Escape cancels. Its native text input retains normal text-selection shortcuts.

Deleting an unused non-default layer is one transaction. Geometry is never
silently deleted or reassigned: a referenced layer reports “Layer is not
empty.” The default/last guaranteed layer cannot be deleted. If an unused
current layer is deleted, `currentLayerId` changes to `defaultLayerId` in the
same publication before the layer disappears.

## Transactions, history, and persistence

Create-plus-current, rename, delete-plus-current-fallback, and explicit current
changes use the existing named-collection transaction API. Each successful
action creates one revision, state transition, dirty-state change, and history
entry. Undo and Redo restore exact layer IDs, names, membership, current state,
and geometry references. Invalid, duplicate, in-use, missing, and blocked
actions publish nothing.

Save/Open round-trip the exact layer table, current/default identities, and
record references. New restores the canonical Default layer. Document-session
replacement rebinds the panel and does not serialize inline editing state.

## Creation and modification semantics

Drawing factories read `currentLayerId`, so Line, Polyline, Rectangle, Circle,
Arc, Ellipse, and Polygon publish on the current layer. Modify operations retain
their established provenance: Copy and Offset preserve the source layer, while
Move, Rotate, Scale, Mirror, Trim, Extend, and grip edits preserve the affected
record layer IDs. L1 does not globally rewrite modify-command output.

Layer actions remain disabled during active commands so one draft cannot span
different current-layer states.

## Deferred L2+

Visibility and locking behavior, colors, linetypes, lineweights, property
overrides, selected-object reassignment, drag ordering, nesting, filters, saved
layer states, and per-viewport overrides remain deferred.
