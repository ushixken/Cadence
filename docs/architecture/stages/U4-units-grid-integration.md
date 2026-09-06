# U4 — Units + Grid Integration

## Authoritative unit flow

The footer reads `DocumentSession.reader.units().length`. Selecting one of the five A9 units (`mm`, `cm`, `m`, `in`, `ft`) calls the active store's `unitGateway.setLengthUnit`, producing one ordinary document transaction. Controller history notifications refresh the footer and viewport. A document-session replacement unsubscribes from the old controller and binds the loaded/new controller, so UI state is never duplicated.

Unit changes remain metadata-only. Existing geometry coordinates, record IDs, and endpoint feature IDs are not rescaled or replaced. Changing `mm` to `m` changes the interpretation of coordinate `100` to 100 metres; it does not convert it to `0.1`.

## Previous grid model

The previous viewport grid used `max(10, niceCeiling(28 pixels / zoom))`, where the nice ceiling followed 1/2/5 powers of ten. It generated a single undifferentiated grid group within the fixed world extent and did not include the authoritative document unit in its scene contract.

## World-space adaptive model

Camera zoom is pixels per document unit. The minimum desired projected interval is 28 pixels:

`requiredWorldSpacing = 28 / zoom`

The minor spacing is the smallest value greater than or equal to that requirement from `1, 2, 5 × 10^n`. There is no unit-specific branch: the resulting number is interpreted in the current authoritative document unit and is included as `scene.grid.unit`. Pan is deliberately absent from spacing selection.

Thresholds are deterministic. For example, zoom values 28, 14, 7, and 2.8 pixels per unit select minor spacings 1, 2, 5, and 10 document units respectively. Comparisons within eight scaled machine epsilons of an exact threshold are treated as equal, preventing floating-point noise from selecting the adjacent level.

## Minimum world interval

The density rule has a separate world-space lower bound supplied by `CaderactGridPolicy.minimumGridSpacing(lengthUnit)`. Effective spacing is `max(densitySelectedSpacing, unitMinimum)`. The initial explicit policy is:

| Unit | Minimum interval | Basis |
| --- | ---: | --- |
| mm | 1 mm | one-millimetre metric drafting resolution |
| cm | 0.1 cm | the same one-millimetre metric resolution |
| m | 0.001 m | the same one-millimetre metric resolution |
| in | 1/16 in | conventional fractional imperial drafting resolution |
| ft | 1/192 ft | the same 1/16-inch imperial resolution |

The value is interpreted in the current A9 document unit; changing unit remains metadata-only and does not rescale geometry. The centralized immutable policy is intentionally replaceable by future visual-grid preferences without introducing settings UI now.

Minimum world interval and minimum screen density solve opposite problems. Screen density selects coarser levels while zooming out. The world minimum stops progressively finer subdivision while zooming in. Once clamped, further zoom leaves the world lattice unchanged and increases its projected cell size. For millimetres, 500%, 1000%, 1400%, 2000%, 5000%, and 10000% select 10, 5, 2, 2, 1, and 1 mm respectively; zoom beyond 5000% therefore produces increasingly sparse cells.

## Major/minor and renderer-neutral contract

Every fifth minor interval is classified as major. Axes remain separate red/green line groups and index zero is excluded from ordinary grid groups. `scene.grid` exposes unit, minor/major spacing, the multiplier, bounded minor/major segment arrays, boundary segments, and the per-axis safety limit. The ordered `lineGroups` remain the common drawing input for both Canvas2D and WebGPU, so neither backend owns CAD grid policy.

## Bounds, anchoring, and numerical safety

Visible world bounds come directly from the camera's screen-to-world transform and are clipped to the established grid extent. Generation covers `floor(minimum / spacing)` through `ceil(maximum / spacing)`, with near-integral ratios stabilized only within scaled machine epsilon. Each line is calculated independently as `index × spacing`; repeated addition, screen-space rounding, pan-derived origins, and previous-level offsets are absent. Integer indices provide stable positive/negative major classification and anchor every 1/2/5 level to world zero. Axes render index zero separately.

Grid and axes retain their exact projected CSS coordinates in the renderer-neutral scene. DPR does not alter logical coordinates, and the D2 Grid marker uses the same exact projected lattice point. Any backend pixel treatment must preserve this shared logical center.

D2 intentionally receives the effective visual-grid spacing, including the unit minimum. Grid Snap therefore cannot acquire a finer lattice after the visual grid clamps. Endpoint and Midpoint candidates are independent of this policy. Separate configurable visual and snap intervals remain deferred.

The prior 1400% reproduction selects the expected 2 mm interval. Lines at world ±2 project exactly through the camera, and the Grid marker for `(2,2)` shares that projection. The minimum clamp is not active there, so the earlier offset was independently addressed by exact logical projection and origin-indexed generation rather than hidden by this enhancement.

At most 512 candidates per axis are emitted. Invalid viewport dimensions produce no grid. Invalid zoom falls back safely, and spacing exponents are clamped to finite IEEE-754 ranges, keeping extreme zoom projections bounded and deterministic.

## History and session behavior

A clean saved state becomes dirty after a unit transaction. Undo restores the prior unit and exact state identity, updating footer and grid; Redo restores the later unit and dirty state. New binds canonical `mm`; Open binds the persisted unit. No state from the old controller leaks through the footer or scene builder.

## Deferred

Physical-size-preserving conversion, Scale Drawing, configurable grid spacing/settings, coordinate HUD/dynamic input, architectural formatting, fractions, and precision/tolerance UI remain deferred.
