# DXF3 — Layers and object properties

DXF3 extends the isolated DXF import pipeline with native Caderact layers and the supported color, linetype, and lineweight vocabulary. Parsing and mapping still complete in an isolated store before one validated `DocumentSession` replacement; renderers contain no DXF-specific behavior.

## Neutral tables and identity

`ParsedDxf` now includes ordered `layers` and `linetypes` collections plus `$CLAYER` in source metadata. A neutral layer contains its DXF name, handle for diagnostics only, visibility/lock state, ACI and optional true color, linetype name, lineweight enum, and source position. Table entries share a bounded `maxTableEntries` limit.

Every imported layer receives a fresh opaque Caderact ID. DXF names and handles never become identity. Names are trimmed, validated, and unique case-insensitively; corrupt supported table data fails the complete import. Layer `0` is imported normally or synthesized deterministically when absent. Missing or unknown entity layer references map to Layer `0` with a warning, so records never contain dangling layer IDs.

`$CLAYER` selects the matching imported layer case-insensitively when it is visible and unlocked. An unknown, hidden, or locked current layer falls back deterministically to the first usable imported layer, preferring Layer `0` by ordering. If every layer is unavailable, Layer `0` is recovered as visible and unlocked. The native default layer is always Layer `0`.

## Visibility and locking

A negative LAYER ACI means off. DXF frozen bit 1 is intentionally collapsed into Caderact's single `visible: false` state and diagnosed; new-viewport frozen bit 2 is ignored with a loss warning because viewport-specific layer state is out of scope. Locked bit 4 maps directly to `locked: true`.

After import, ordinary document readers control behavior: hidden records are absent from rendering, selection, grips, Osnap, and tracking inputs; locked records remain visible/referenceable but are excluded from editing and selection. There are no DXF exceptions in those systems.

## Property mapping

Color uses native lowercase `#rrggbb` or `null` for ByLayer. Valid group 420 true color wins over group 62 ACI. Explicit ACI 1–255 converts deterministically through the AutoCAD color index; entity ACI 256 is ByLayer. Entity ACI 0 (BYBLOCK) falls back to ByLayer with a warning because native Blocks do not yet exist. Negative entity ACI is normalized to its explicit color with a diagnostic and is never confused with the LAYER-table off convention.

Linetype uses `null` for ByLayer and maps compatible names to the native `continuous`, `dashed`, `dotted`, or `dash-dot` values. Common aliases such as HIDDEN and DOT are accepted. BYBLOCK and arbitrary/custom patterns fall back to ByLayer for objects (Continuous for layers), with an explicit warning. Parsed LTYPE patterns are retained only as neutral metadata; DXF3 does not claim arbitrary pattern preservation.

Lineweight uses `null` for entity ByLayer. Exact native values are retained; other valid explicit DXF hundredths-of-a-millimeter values map to the nearest native value, with the smaller native value winning an exact distance tie. DXF default maps to the native default. Layer inheritance/default and BYBLOCK values use safe native fallbacks; lossy cases are diagnosed. No invalid native lineweight can be published.

## Native rendering and atomicity

Mapped records flow unchanged through the existing record/layer property resolver, `ViewportScene`, and both Canvas2D and WebGPU renderers. The import mapper assembles the entire layer table and record table, validates the canonical document, and only then returns the replacement store. Fatal table/property corruption cannot partially publish layers, assignments, or properties, and the active drawing remains unchanged.

## Deferred DXF4 scope

Blocks/INSERT—including the special Layer `0` inheritance rule and real BYBLOCK resolution—remain deferred. Arbitrary linetype engines, viewport-specific layer states, plot styles, Text/MTEXT, dimensions/DIMSTYLE, hatch, splines, OCS conversion, 3D flattening, export, and merge import are also out of scope.
