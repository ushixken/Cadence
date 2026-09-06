# D5 — Polyline

## Command and aliases

`Polyline` is registered through the existing command registry with `Pline` and `PL` aliases. It accepts an open sequence of straight 2D segments. P1 starts the draft, every later accepted point fixes one connected draft segment, Enter publishes the open path, Escape cancels the complete draft, and the `Close` keyword explicitly closes and publishes an eligible path.

## Session state and point input

`PolylineDraftSession` owns frozen accepted points, unpublished Line records for accepted segments, the current pointer preview point, close eligibility, and command-local Step Undo. Outward point and segment collections are immutable snapshots. The session is independent of rendering and delegates its single final publication to the document record gateway.

Pointer, absolute typed, relative typed, unit-suffixed, and mixed input all use the existing D1 pipeline. Relative points anchor to the latest accepted point. Polyline defines no coordinate grammar.

## Snap integration

The viewport sends pointer positions through the unchanged D2A resolver. Committed Endpoint and Midpoint candidates, enabled Grid candidates, and every accepted Polyline point participate in the same 10 CSS-pixel acquisition and ranking policy. This includes the first, older, and latest points. Shift temporarily bypasses every candidate and release immediately restores acquisition.

Manual acquisition of P1 is ordinary point acceptance: it adds the valid latest→P1 segment and leaves Polyline active. Only the explicit `Close` keyword has command-finishing semantics.

## Accepted and preview rendering

Accepted segments use the existing fixed accepted-draft renderer-neutral line group. Only the latest accepted point→resolved pointer segment uses the moving preview group. Every accepted point retains the existing fixed draft-point marker, and snap feedback remains above both groups.

D5 adds no connected renderer primitive. Consecutive segments contain exactly equal shared endpoint coordinates and enter one renderer-neutral group; accepted-point markers render above every joint in both Canvas2D and WebGPU, preventing cap notches without duplicating path mathematics in either backend. Committed Line rendering is unchanged.

## Step Undo

Command-level Undo removes only the latest unpublished segment and its endpoint, restores the preview origin to the preceding accepted point, and rebuilds Draft Point candidates. It never invokes document Undo or changes revision/history. Once only P1 remains, one further Step Undo clears P1 and returns the active session to first-point acquisition; another returns `no-step`.

## Enter and Close

Enter with no accepted segment completes as a no-op and publishes nothing. With one or more accepted segments, Enter publishes only those fixed segments; the moving preview is excluded.

`Close` requires at least one accepted segment (two accepted points). It adds latest→P1 unless the latest point already equals P1, then publishes automatically. A manually accepted closing segment is therefore not duplicated. Close before eligibility is rejected while preserving the active draft.

## Persistent representation and history

A completed Polyline is represented by ordinary version-1 Line records. Each segment receives existing stable record and endpoint feature identities and inherits the authoritative current layer. All records publish together through one `recordGateway.createAll` transaction, producing one revision/history entry. One Undo removes the entire created Polyline and one Redo restores its exact records and identities. No Polyline schema or fileVersion change is introduced.

If publication fails, the transaction rolls back without partial authoritative geometry and the complete draft remains active for retry. A failed Close retains the prepared closing segment, so retrying Close does not add a duplicate.

## Degenerate and lifecycle policy

An accepted point equal to the current latest point is rejected. No zero-length Line is allocated, the command remains active, and existing draft state is unchanged. Equal non-consecutive points remain valid, allowing manual closure and intentional retracing.

Pointer leave clears only the moving preview; accepted points and segments remain intact. Escape removes the whole unpublished session. New/Open retain the established policy of being blocked while a command is active. Renderer recovery reconstructs accepted geometry, markers, and the current preview from transient session state without publishing or duplicating it. D3 and UX2 continue treating committed output as ordinary Lines.

## Deferred features

D5 intentionally defers arc/bulge segments, width, spline/polycurve behavior, 3D Polyline, fillet/chamfer, Polyline-specific grips, Ortho, Polar Tracking, dimensions, advanced object snaps, and a persistent Polyline record.
