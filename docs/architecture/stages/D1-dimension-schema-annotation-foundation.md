# D1 — Dimension schema and annotation foundation

## Status

Implemented. D1 establishes native, non-associative dimension records and shared presentation infrastructure. It intentionally adds no dimension commands, selection, grips, or object-snap behavior.

## Persistence

New documents and saves use strict `fileVersion: 2` / `formatVersion: 2`. The v2 document adds one closed `dimensionStyle` object and three closed native record kinds: `dimension-linear`, `dimension-angular`, and `dimension-radial`. Existing valid v1 files load through a one-way in-memory migration that supplies the default style; the next save emits canonical v2. Unknown fields and malformed record/style values remain rejected.

Every definition point owns a stable `featureId`. Dimensions also retain ordinary object properties and a `layerId`, so visibility and locking follow the existing layer read model. Records are non-associative: their definition points are stored values rather than references to source geometry.

## Dimension style

One document-level style owns model-space text height, arrow size, extension gap/overrun, text gap, linear/angular precision, unit display, prefix/suffix, and the `closed-filled` arrow style. The record gateway exposes atomic dimension creation and the style gateway publishes style changes through the normal document transaction/history authority. Undo and Redo therefore restore exact style and record values.

Defaults are: text height `2.5`, arrow size `2.5`, extension gap/overrun `1`, text gap `.75`, linear precision `3`, angular precision `2`, units shown, empty prefix/suffix, and closed-filled arrows.

## Measurement and presentation

`DimensionGeometry.measure` is the semantic measurement adapter. Linear dimensions support horizontal, vertical, and aligned values; angular dimensions expose the smaller included angle; radial dimensions expose radius or diameter. `DimensionFormatter` applies precision, document unit labels, prefix/suffix, and explicit text overrides.

`DimensionGeometry.derive` is pure and currently produces full linear presentation geometry: extension lines, dimension line, two filled arrow triangles, and a text descriptor. Angular and radial measurement/persistence are supported, while their graphical presentation returns the explicit `presentation-deferred` result for a later dimension stage.

## Renderer and text ownership

`ViewportScene` reads visible records on every build, derives dimension presentation in model space, and projects lines, filled triangles, and annotations into renderer-neutral screen-space scene data. Canvas2D and WebGPU consume the same triangle primitive; neither renderer contains dimension math.

Dimension text is rendered by one pointer-transparent DOM annotation layer owned by the viewport host and shared by both renderers. Position, rotation, color, value, and model-space-scaled font size come from the scene. Renderer recovery rebuilds it from current document state.

## Deferred

- dimension creation/edit commands and UI
- angular and radial graphical presentation
- dimension selection, hit testing, grips, and feature snapping
- associativity and source-reference repair
- multiple named styles and general-purpose text entities
