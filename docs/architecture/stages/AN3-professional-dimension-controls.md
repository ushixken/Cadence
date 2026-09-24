# AN3 — Professional Dimension Controls

AN3 extends the existing native measured-dimension records; it does not introduce a second annotation, formatting, or style authority. Linear, Angular, Radial, Ordinate, and Arc Length dimensions share the same per-record control contract and continue to derive all visible text and geometry through `DimensionFormatter` and `DimensionGeometry`.

## Semantic controls

Each measured dimension stores nullable `prefixOverride` and `suffixOverride` values. `null` inherits the named `DimensionStyle`; a string is an explicit per-object override. `textOverride` remains separate: a nonempty override replaces the displayed automatic string, while clearing it restores the measured display without changing geometry or measurement.

Tolerance state is numeric and semantic. `toleranceMode` is `none`, `symmetric`, or `deviation`; upper and lower values are finite and non-negative. Symmetric tolerance requires a positive upper value. Deviation requires at least one positive value. Formatting uses the dimension's existing linear or angular precision and preserves the document's authoritative units. Limits and alternate-unit display are deferred.

Existing records and newly created dimensions default to inherited prefix/suffix, no tolerance, automatic text placement, and no manual point. Their presentation is therefore unchanged.

## Text placement and editing

`textPositionMode` is either `automatic` or `manual`. Automatic placement remains entirely derived by `DimensionGeometry`. Manual placement owns one feature-bearing `manualTextPosition`; the resulting grip participates in the existing grip, transform, copy, history, and selection systems. Restoring automatic placement removes that stored point.

The Properties panel exposes a read-only geometric measurement plus prefix, suffix, text override, tolerance mode/values, and automatic/manual placement for a single measured dimension. Changes use the normal record gateway and document transaction history. Multi-selection remains conservative: common style assignment is available, while per-object semantic controls are not guessed or merged.

## Style and units ownership

Named `DimensionStyle` remains the default authority for typography, arrows, precision, unit visibility, prefix, and suffix. Per-dimension prefix/suffix values only override the corresponding style values. Tolerance and placement are per-dimension because they describe an individual measurement callout.

Alternate units are intentionally deferred. The current Units architecture owns one document length unit and DimensionStyle has no secondary-unit definition. Adding alternate units in AN3 would create a competing conversion/precision authority rather than a clean extension of the existing system.

## Persistence and DXF

Native v3 persistence stores the semantic controls and validates their complete shape. Old records load with the unchanged defaults. Manual text feature identity is preserved through save/load and Undo/Redo.

The current DXF exporter can faithfully preserve ordinary measured dimensions and explicit text override. It does not yet map per-object prefix/suffix, tolerance, or manual text placement. Export therefore fails explicitly with `DXF_EXPORT_DIMENSION_CONTROL_UNSUPPORTED` whenever those controls are present instead of silently discarding meaning.

Deferred work includes Limits tolerance presentation, alternate units, rich dimension text, and faithful DXF mappings for the newly introduced controls.
