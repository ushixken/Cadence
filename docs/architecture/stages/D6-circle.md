# D6 — Circle

## Command and interaction

`Circle` is registered through the existing command registry with alias `C`. It is a finite center/radius-point command: the first D1 pointer or typed point establishes the center, the second establishes a radius point, and successful acceptance publishes and completes automatically. Prompts distinguish `Specify center point` from `Specify radius point`.

Absolute, relative, unit-suffixed, pointer, and mixed input use the shared D1 pipeline. Relative radius points anchor to the accepted center. D6 adds no radius-only grammar or mode keywords.

## CircleDraftSession

`CircleDraftSession` owns a frozen center, current resolved radius point, and derived radius/preview. The center never changes after acceptance. It is exposed through `getDraftPoints()` and the D2A `getSnapCandidates()` contract, so it remains visibly marked and acts as one transient Draft Point without becoming document state.

The preview is semantic `{center, radius}` data where radius is `hypot(radiusPoint - center)`. Viewport only coordinates pointer resolution and passes the session preview into ViewportScene; it does not approximate Circle geometry.

## Persistent v1 representation and validation

D6 extends the explicitly closed version-1 record union with:

```text
{ id, type: "circle", layerId, center: { x, y }, radius }
```

Circle has one stable record identity. Its center coordinates and radius are geometry values, not invented endpoint topology. Validation requires an exact closed record/center shape, non-empty unique record ID, existing layer ID, finite center coordinates, and a finite radius strictly greater than zero.

This is a complete addition to the supported v1 record union, not a breaking envelope change, so `fileVersion` and document `formatVersion` remain 1. Save/load canonicalization includes exactly the fields above, preserves exact center/radius/ID/layer values, and rejects unknown fields, missing center data, non-finite coordinates/radii, and non-positive radii. Runtime preview state is never persisted.

## Publication and history

`recordGateway.createCircle` allocates one stable Circle ID and captures the authoritative current layer. The record is published through the existing `createAll` transaction boundary. One Circle produces one transaction, revision, and history entry; one Undo removes it and one Redo restores the exact identity and geometry. Failed publication rolls back without a partial record and preserves center/radius-point draft state for retry.

## Snapping

Both accepted pointer positions use D2A unchanged. Committed Line Endpoint and Midpoint, enabled Grid, and the transient Circle center Draft Point participate in the shared resolver and priority policy. Grid Snap OFF removes only Grid. Shift bypasses every snap candidate and release immediately reacquires. Committed Circles intentionally contribute no fake Endpoint or Midpoint candidates; Center, Quadrant, Tangent, and Nearest snaps remain deferred.

## Renderer-neutral scene and rendering

The authoritative read-side projects Circle records into renderer-neutral screen-space circle groups containing semantic center and radius values. Preview and selected Circle groups use the same contract and preserve the established draw-layer ordering alongside Line groups.

Canvas2D consumes semantic circles with its native arc path. WebGPU uses the shared `CircleTessellation` rendering utility; command, Viewport, and document code never tessellate. Segment count is derived from a maximum 0.25 CSS-pixel sagitta, bounded from 24 to 1,024 segments. This adapts to useful zoom levels, stays deterministic and finite at extremes, and leaves authoritative geometry exact. DPR changes backing-store rasterization only and do not change semantic CSS-space center/radius.

## Selection and grips

D3 record hit testing dispatches by geometry type. Circle distance is measured in CSS pixels as the absolute difference between pointer-to-center distance and projected radius. Points within the existing 8 CSS-pixel tolerance of the circumference hit; points clearly inside or outside miss. Stable record ID resolves ties with other hits.

Selected Circles use the existing selected-geometry color through the semantic selected-circle group. D6 intentionally exposes no Circle grips; Line grip behavior remains unchanged.

## Degenerate and lifecycle policy

A radius point exactly equal to the center produces radius zero and is rejected. The center and command remain active, no record or ID is published, and revision/history/dirty state are unchanged. This exact policy matches the document's finite numeric invariants and avoids an arbitrary geometry epsilon.

Escape or Enter before completion discards transient state without publication. Pointer leave clears only the radius preview and retains the center. Command replacement and New/Open follow the existing active-command blocking policy. Renderer recovery reconstructs the current semantic preview from the session without mutation or duplication.

## Deferred work

D6 defers Diameter, two-point, three-point, tangent, and numeric-radius modes; Arc and Ellipse; Circle Center/Quadrant/Tangent/Nearest snaps; Circle editing grips; Ortho, Polar Tracking, dimensions, and UI restructuring.
