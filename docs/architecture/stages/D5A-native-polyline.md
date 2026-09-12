# D5A — Native Polyline

## Why D5A exists

D5 originally published every Polyline segment as an independent Line. That contradicted CAD object identity and made selection, history, topology, and future modification ambiguous. D5A makes Polyline one native object; independent touching Lines remain independent and are never auto-joined.

## Record and topology

Strict version 1 recognizes:

```js
{ id, type: "polyline", layerId, vertices: [{ x, y, featureId }, ...], closed }
```

The record has one stable object ID. Ordered immutable vertices have stable feature IDs and are the only persistent topology. Segments are derived in order; a closed record derives the final last-to-first segment without storing a duplicate first vertex. Open records require at least two usable vertices and closed records at least three. Adjacent duplicates, duplicate closure vertices, non-finite coordinates, unknown fields, and invalid feature identities are rejected. `fileVersion` and `formatVersion` remain 1.

## Drafting and closure

Accepted draft points remain fixed and only the next rubber-band point moves. Step Undo removes the latest unpublished vertex. Escape discards the draft. Enter publishes one open native record by default, in one transaction and history entry. Failed publication retains the complete draft.

The clickable `Close` option appears when at least three usable vertices exist and publishes `closed: true`. Returning to P1 before Close is canonicalized without duplicating P1 or creating a zero-length seam.

### Snap-to-start auto-completion

After a pointer click has resolved through D2A, Polyline compares the accepted
model coordinate with its original first vertex. Exact equality while Close is
eligible calls the same native Close publication path immediately. Hovering or
snapping near P1 never accepts geometry and cannot finish the command. The
condition is coordinate equality, not CSS distance, marker overlap, or snap
kind, so Draft Point, Endpoint, and Grid paths behave consistently; Shift
bypass only closes if its raw accepted coordinate is exactly P1.

The resulting record is one `closed: true` Polyline. P1 appears once in the
persistent vertex array, retains no duplicate seam feature ID, and the final
segment is derived last-to-first. Explicit Close is equivalent. Step Undo works
until closure, while PersistentClose remains its separate preview/Enter policy.
Each successful closure is one transaction/history entry; Undo/Redo preserve
the exact native record and feature identities. Failed publication leaves the
draft retryable under the normal Close failure policy.

`PersistentClose=No` is shown through the U5B option system. With a live candidate `C`, the draft session derives both transient edges—latest-to-`C` and `C`-to-first—from that same candidate. Toggling Yes therefore shows the prospective closing edge immediately and pointer or snap movement updates both edges together. With no candidate, the accepted path may show its derived latest-to-first closure. Enter publishes only the accepted vertices as a closed record; the live candidate is never implicitly committed. Toggling No removes only the closing preview. The option is transient and defaults to No for every new or repeated command; it is not a saved preference.

## Rendering, selection, and snapping

ViewportScene exposes semantic ordered Polyline vertices plus derived open/closed segments. Canvas2D and WebGPU consume the existing renderer-neutral line batches. Selecting any segment selects the one record and highlights its entire curve. D3A Window requires every vertex/segment to be contained; Crossing succeeds when any segment touches or enters the box.

Every persistent vertex supplies an Endpoint candidate and resolves through A10 using its feature ID. Every derived segment supplies a Midpoint candidate, including the closed seam. Draft Points, Grid state, and Shift bypass remain owned by D2A. A selected native Polyline exposes one UX2 vertex grip per unique persistent feature ID. Dragging previews one vertex replacement and publishes one transaction on release while preserving record, layer, and vertex identities; no-op and cancelled drags do not publish.

## Command resolution

The former Polygon `Pol` alias was the ambiguity: exact alias ranking beat Polyline's canonical prefix. Polygon now uses `PG`; Polyline retains `Pline` and `PL`. Registry definitions expose a generic numeric preference used only to break matches in the same quality category, so Polyline wins shared canonical prefixes such as `p`, `po`, `pol`, and `poly`, while the more specific `polyg` resolves to Polygon. Exact canonical names and aliases still outrank prefix matches.

Arc-mode segments, Helpers, Length, Direction, advanced constraints, Join/Explode, and grouped Rectangle/Polygon identity remain deferred.
