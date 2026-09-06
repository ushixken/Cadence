# D8 — Polygon

## Command and interaction

`Polygon`, with alias `Pol`, is an explicitly repeatable finite construction command. Its phases are side count, center, and radius/vertex point. A valid radius point publishes immediately and completes the command.

The side-count prompt accepts integers from **3 through 1024**. An empty Enter accepts the session default of **4**. Decimal, signed-negative, non-numeric, unsafe, and out-of-range values are rejected without advancing the session. The upper bound limits preview buffers and atomic transaction size.

The command input now recognizes a small command-neutral `acceptsEmptyInput` session capability. An active session that exposes it receives empty Enter through its ordinary `handleInput` route; all other finite commands retain the established empty-Enter finish behavior. Numeric option parsing remains separate from D1 coordinate parsing.

## PolygonDraftSession and geometry

`PolygonDraftSession` owns the side count, frozen center, current resolved radius point, and derived immutable geometry. The pure `PolygonGeometry` helper owns parsing and regular-polygon math; Viewport and renderers do not duplicate it.

The construction is inscribed. The accepted radius point is exactly vertex zero. With `angle0 = atan2(radiusPoint - center)`, vertex `i` is evaluated directly at `angle0 + i * 2π/N`. Each edge references adjacent frozen vertices and the last edge returns to vertex zero. Direct index evaluation avoids incremental angular drift, and shared edge endpoints are the same immutable vertex objects.

Once the center exists, pointer movement changes only the radius candidate. A valid candidate exposes exactly N vertices and N closed preview Lines through the existing renderer-neutral preview group. Center, preview, and candidate state are transient and never change document revision, history, dirty state, or persistence.

## D1 and D2A integration

Center and radius point use the existing D1 parser for pointer, absolute, relative, unit-aware, and mixed input. Relative radius input anchors to the accepted center.

Pointer acquisition uses D2A unchanged: committed Endpoint, committed Line Midpoint, enabled Grid, and the accepted Polygon center as a Draft Point. Grid Snap OFF excludes only Grid. Shift bypasses all candidates and release immediately reacquires. D8 adds no Polygon-specific object-snap kind.

## Publication, layers, and history

D8 adds no persistent Polygon record. A valid construction creates N ordinary Line records, each with its own stable record and endpoint feature IDs and the authoritative current layer. All records publish through one `createAll` transaction. Publication is all-or-nothing, creates one revision/history entry, and one Undo/Redo removes/restores the entire exact edge set.

This representation needs no document schema, `formatVersion`, `fileVersion`, renderer, selection, snapping-topology, or grip changes. After commit, each edge behaves as an independent existing Line for selection and UX2 grips; D8 intentionally adds no grouped-object semantics.

## Degenerate and lifecycle policy

A radius point equal to the center produces radius zero and is rejected. The command and center remain active for retry, with no record allocation or authoritative mutation. Failed publication similarly preserves side count, center, radius candidate, and preview while creating no partial Lines.

Escape in any phase clears the transient session. Empty Enter after the side-count phase follows the existing finite-command cancellation convention and cannot publish incomplete geometry. Pointer leave hides only the moving radius preview and keeps the center marker. Renderer recovery rebuilds the preview from session state. Command replacement and New/Open retain the existing active-command blocking policy.

U5A stores canonical `Polygon` after activation by either `Polygon` or `Pol`. A later eligible Space tap launches a fresh session with no retained center, radius, or side count; the new session again defaults to four sides.

## Deferred work

D8 defers Circumscribed and Edge modes, arbitrary polygons, persistent or grouped Polygon objects, grouped selection, Polygon-specific grips or committed snaps, command-option memory, Ortho, Polar Tracking, dimensions, and UI restructuring.
