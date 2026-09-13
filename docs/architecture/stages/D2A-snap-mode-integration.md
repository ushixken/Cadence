# D2A — Snap Mode Integration / Object Snap Behavior

## Supported modes and ownership

`SnapResolver` remains the single pure, renderer-neutral authority for pointer snapping. It resolves committed Line endpoints, derived Line midpoints, the current U4 adaptive-grid intersection, and transient Draft Point candidates supplied by an active command. Snap results are transient: they create no document transaction, history entry, persistent field, state identity, or dirty-state change.

Endpoint candidates use the current authoritative Line coordinates and stable A10 endpoint references. Midpoints are calculated from current Line geometry and have no persistent topology identity. Grid candidates are exact integer multiples of the current visible adaptive spacing. Draft Points are the active command's accepted points, including its latest/current point, and are never written to the document merely because they participate in snapping.

## Mode behavior

Endpoint and Midpoint are currently always available. Draft Point is automatic whenever an active drawing session supplies candidates. The existing Grid Snap footer button controls only Grid participation and reflects the transient state through its active style and `aria-pressed`. Turning Grid Snap off does not hide the visual grid or disable Endpoint, Midpoint, or Draft Point. With no user-preference system, fresh sessions, New, and Open reset Grid Snap to OFF.

Holding Shift bypasses all candidate types and sends the raw pointer world coordinate to the active interaction without changing mode state. Pressing or releasing Shift while the pointer is stationary immediately reevaluates the last known pointer, so normal acquisition returns on release.

## Resolution and ranking

All candidates are measured in CSS pixels against the same raw pointer and 10-pixel acquisition tolerance. The resolver first identifies the nearest distance, then forms one deterministic near-tie set containing candidates no more than 0.75 CSS pixels farther than that nearest candidate. Only inside that set does semantic priority apply:

1. Endpoint
2. Draft Point
3. Midpoint
4. Grid

Distance therefore wins outside the narrow tie window, while stable semantic keys make equal candidates independent of document enumeration order. This two-stage choice avoids pairwise-comparator cycles in crowded geometry.

## Feedback contract

The raw UX1 CAD cursor stays on the physical pointer. The winning exact world point drives Line preview/input and is independently projected for its marker. Endpoint uses a square, Draft Point a diamond, Midpoint a triangle, and Grid a hash. Every marker is symmetric around one projected logical center and uses renderer-neutral, fixed screen-space geometry.

## Future command integration

The reusable path is:

`pointer → screenToWorld → authoritative record candidates + command transient candidates → enabled modes → SnapResolver → resolved point → command preview/input`

An active command exposes `getSnapCandidates()` and returns plain transient candidate descriptors. It separately exposes `hasPointerPreview()` so the viewport can decide whether pointer movement should resolve and update a preview without inspecting the command's private draft representation. The resolver contains no Line-, Rectangle-, Polyline-, Circle-, or Arc-specific control flow. New command types may supply transient candidates through this contract while authoritative object candidate collection remains centralized. Additional snap kinds still require an explicit shared semantic definition; D2A does not implement new drawing commands, Ortho, Tracking, or UX2 behavior.
## First-point availability

Grid candidates participate in D2A from command start, including before a draft point exists. Drafting constraints are optional reference-dependent preprocessing only; Grid resolution is reference-independent.
