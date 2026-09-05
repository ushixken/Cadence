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

Thresholds are deterministic. For example, zoom values 28, 14, 7, and 2.8 pixels per unit select minor spacings 1, 2, 5, and 10 document units respectively.

## Major/minor and renderer-neutral contract

Every fifth minor interval is classified as major. Axes remain separate red/green line groups and index zero is excluded from ordinary grid groups. `scene.grid` exposes unit, minor/major spacing, the multiplier, bounded minor/major segment arrays, boundary segments, and the per-axis safety limit. The ordered `lineGroups` remain the common drawing input for both Canvas2D and WebGPU, so neither backend owns CAD grid policy.

## Bounds, anchoring, and numerical safety

Visible world bounds come directly from the camera's screen-to-world transform and are clipped to the established grid extent. Generation starts at `ceil(minimum / spacing)` and ends at `floor(maximum / spacing)`; it does not walk from the origin through invisible coordinates. Integer grid indices provide stable positive/negative classification and world-origin anchoring.

At most 512 candidates per axis are emitted. Invalid viewport dimensions produce no grid. Invalid zoom falls back safely, and spacing exponents are clamped to finite IEEE-754 ranges, keeping extreme zoom projections bounded and deterministic.

## History and session behavior

A clean saved state becomes dirty after a unit transaction. Undo restores the prior unit and exact state identity, updating footer and grid; Redo restores the later unit and dirty state. New binds canonical `mm`; Open binds the persisted unit. No state from the old controller leaks through the footer or scene builder.

## Deferred

Physical-size-preserving conversion, Scale Drawing, coordinate parsing, typed suffixes, snapping, coordinate HUD/dynamic input, configurable grid spacing/settings, architectural formatting, fractions, and precision/tolerance UI remain deferred.
