# D4 — Rectangle

## Command and interaction

`Rectangle` is registered through the existing command registry with the `Rect` alias. It is an axis-aligned, two-corner command: the first pointer or D1 typed point establishes P1, pointer movement previews the shape, and the second pointer or typed point establishes the opposite corner P2 and completes the command immediately. Absolute, relative, and unit-suffixed input all use the shared D1 parser; Rectangle owns no coordinate parser.

Escape before or after P1 cancels without publication. Enter before P1 or after only P1 finishes as a no-op and discards the transient draft. Pointer leave hides the current preview while retaining P1, allowing pointer re-entry to resume safely.

## Draft/session ownership

`RectangleDraftSession` owns only the frozen first corner, current transient pointer point, deterministic derived preview edges, and the final atomic-publication attempt. Viewport converts pointer coordinates, asks D2A for the resolved point, and passes that point into the session. The generic command router accepts pointer-session outcomes so a finite two-point command can complete through the same lifecycle as typed input.

P1 is exposed through the command-neutral `getDraftPoints()` and `getSnapCandidates()` contracts. It therefore appears as a stable transient point marker and participates as an automatic Draft Point candidate without becoming document geometry. `hasPointerPreview()` tells the viewport when pointer movement should update the command without exposing Rectangle internals.

## Snap integration

Both pointer corners use the single D2A `SnapResolver`. Endpoint, Midpoint, enabled Grid, and the P1 Draft Point follow the existing 10 CSS-pixel acquisition tolerance and ranking. Grid Snap OFF excludes only Grid. Shift bypasses every snap kind temporarily and accepts the raw pointer world coordinate. Rectangle contains no snap ranking, tolerance, projection, or marker logic.

## Preview contract

For P1 `(x1,y1)` and P2 `(x2,y2)`, the session derives A `(x1,y1)`, B `(x2,y1)`, C `(x2,y2)`, and D `(x1,y2)`, then exposes A→B, B→C, C→D, and D→A. This formula works identically in all four drag quadrants and never mutates P1.

ViewportScene consumes these as generic renderer-neutral preview Lines. The existing preview line group contains four segments for Rectangle and one segment for Line. Canvas2D and WebGPU therefore receive identical geometry and contain no Rectangle mathematics.

## Persistent representation and history

A completed Rectangle is represented by four ordinary version-1 Line records. Each edge receives the existing stable record and endpoint feature identities and inherits the authoritative current layer through `recordGateway.createLine`. The four records are passed together to `recordGateway.createAll`, which opens one DocumentController transaction. There is no persistent Rectangle schema and no fileVersion change.

Publication is all-or-nothing: one Rectangle produces one revision/history entry, one Undo removes all four Lines, and one Redo restores the exact records and identities. If publication fails, the transaction rolls back, no partial geometry appears, and P1/current preview remain available for retry.

## Degenerate policy

If P1 and P2 have equal X or equal Y, width or height is zero. D4 rejects the second corner, creates no Line records, leaves the command active at P1, and prompts for a valid opposite corner. This prevents zero-length and duplicated edges while allowing immediate correction.

## Lifecycle and deferred features

Command cancellation clears draft points, preview, and snap feedback. New/Open retain their established rule of being blocked while any command owns transient state; after cancellation or completion, no Rectangle state survives document replacement. Renderer recovery rebuilds the preview from the active session and never promotes it into the document or duplicates it.

D4 intentionally defers rotated, three-point, rounded, and dimension-driven rectangles; dynamic width/height input; Rectangle-specific grips; Polyline and Circle; Ortho and Polar Tracking; and additional object-snap modes.
