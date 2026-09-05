# A6 — Read-side and renderer migration

## Authoritative persistent read-side

Committed CAD records have one authoritative owner: `CaderactDocument`. Its
read-only `records()` query returns a newly allocated, frozen collection of the
current immutable records, ordered deterministically by stable record ID.
Callers cannot mutate the document through either the returned collection or
its records. The older `lines()` query remains as a compatibility convenience,
but the viewport rendering path no longer depends on it.

Stable-ID sorting is only the current deterministic enumeration/render order.
It does not define document creation order, layer stacking, or a future CAD
z-order policy; those semantics remain deliberately undecided.

The committed rendering flow is:

```text
CaderactDocument.records()
  -> ViewportScene projection
  -> renderer-neutral line groups
  -> Canvas2DRenderer or WebGPURenderer
```

There is no viewport-local or renderer-local persistent geometry collection,
no committed-geometry append call, and no dual-write path.

## Ownership boundaries

- `CaderactDocument` owns committed records, object/feature IDs, layers, and
  current document content.
- `DocumentController` owns transactions, revision, history, and state identity.
- `LineDraftSession` owns unfinished Line segments, its active endpoint, and
  rubber-band pointer state.
- `ViewportScene` reads and projects current records while composing ordered
  persistent and transient render groups.
- Renderer implementations consume scene buffers and own only graphics/pixel
  resources.

## ViewportScene projection

Every scene build calls the authoritative `records()` read view. Supported
Line records are transformed into disposable screen-space coordinates. The
source records are never annotated or mutated. Unsupported record types are
deterministically skipped; A6 does not attempt to render future geometry.
Skipping is a safe current projection rule, not a permanent policy for future
record types.

Scene ordering remains grid and boundary, axes, committed geometry, then the
transient active-tool overlay. Both rendering backends receive the same ordered
`lineGroups` contract and neither backend knows about document schemas.

## Persistent and transient Line flow

During Line, accepted segments and the rubber band render only in the transient
overlay. The document read-side remains unchanged. Enter publishes all accepted
segments in one A5 transaction; the next scene build reads those committed
records while the cleared draft contributes no overlay, preventing visual
duplication. Escape removes only the transient draft.

Because Undo and Redo change `CaderactDocument`, the next scene build naturally
removes or restores geometry with no renderer-side history. Exact IDs and
coordinates come from A4's restored records. Changes published directly through
the controller/record gateway render identically and need no viewport append.

## Update strategy

A6 deliberately uses pull-based full scene construction at the current scale.
Whenever the viewport requests a frame, it reads the current document state.
The current controller API itself does not schedule UI frames, so a future
non-viewport Undo command or external editing workflow must request rendering
after it publishes. This avoids adding an event bus, reactive store, diff
engine, cache, dirty regions, or spatial index before those are needed.

## WebGPU recovery status

A6 does not touch renderer creation or device-loss lifecycle. The known defect
therefore remains: after a canvas has acquired a WebGPU context, attempting a
Canvas2D fallback on that same canvas may produce a null/unusable context. The
existing regression test continues to document that defect. Fixing it requires
a renderer/canvas lifecycle decision rather than read-side ownership changes.

## Deferred work

A6 adds no A7 layer/property transactions, selection, snapping, new commands,
persistence, file formats, rendering-performance architecture, global history
shortcuts, framework migration, or public Help content.
