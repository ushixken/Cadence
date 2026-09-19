# DXF6 — Dimension and DIMSTYLE interoperability

DXF6 maps Caderact's native linear, aligned, angular, radius, and diameter dimensions to semantic DXF `DIMENSION` entities. Import remains isolated: the parser produces neutral values, the importer allocates fresh native identities through document gateways, and only the completed canonical store can replace the active document.

## DIMSTYLE mapping

Named `DIMSTYLE` table entries map to native named dimension styles. The supported fields are `DIMTXT` → `textHeight`, `DIMGAP` → `textGap`, `DIMASZ` → `arrowSize`, `DIMEXO` → `extensionGap`, `DIMEXE` → `extensionBeyond`, `DIMDEC` → `linearPrecision`, and `DIMADEC` → `angularPrecision`. `$DIMSTYLE` selects the native current style. Names are unique case-insensitively, missing fields use native defaults, invalid values reject parsing, and unknown entity style references fall back to Standard with a diagnostic.

Native style and record IDs never enter DXF. Import allocates new style, record, and feature identities. Custom native prefix/suffix, unit visibility, or non-default arrow style cannot be represented by the DXF6 subset and fail export explicitly; nonempty foreign `DIMPOST` formatting is diagnosed and ignored on import.

## Dimension mappings

- Horizontal and vertical native dimensions use rotated-linear DXF type 0 with rotation 0° or 90°.
- Aligned dimensions use type 1.
- Angular dimensions use three-point angular type 5. Two-line angular type 2 is explicitly unsupported.
- Diameter dimensions use type 3; the native center is derived from the two diameter endpoints.
- Radius dimensions use type 4.

Definition, placement, and leader/text points remain model-space coordinates. A simple group 1 text override maps to `textOverride`; `<>` means the measured value. Compound measurement substitution and formatted/multiline overrides are diagnosed and skipped rather than flattened. Nonplanar dimensions, ordinate dimensions, general rotated-linear angles, and other unsupported types are also skipped explicitly.

## Export structure and round trip

The deterministic AC1018 writer emits `$DIMSTYLE`, a sorted `DIMSTYLE` table, and one real `DIMENSION` entity per native dimension. Each dimension receives a deterministic anonymous `*D` block reference and a minimal empty block definition required by the structural form. These anonymous blocks are representation scaffolding only: import reads top-level `DIMENSION` entities and never imports their block contents as duplicate geometry. General block/insert import remains deferred.

Layer assignment, color, linetype, and lineweight use the DXF3 common-property path. Export sorting substitutes semantic layer/style names for internal IDs, preserving deterministic output across fresh identities. The guaranteed round trip is semantic, not byte-for-byte: dimension kind, definition/placement geometry, text override, supported style fields, style reference, layer, and supported properties survive.

## Deferred

Associative dimension references, arbitrary rotated linear dimensions, two-line angular and ordinate dimensions, tolerances, alternate units, rich dimension text, custom arrow blocks, general BLOCK/INSERT import, and renderer changes remain outside DXF6.
