# DXF4 — Text and annotation import

DXF4 imports the faithfully representable subset of single-line DXF `TEXT` as native Caderact Text records. The path remains bounded parsing → neutral `ParsedDxf` → isolated native mapping → canonical validation → one document replacement. Text is rendered, selected, edited, transformed, and persisted exclusively by the existing annotation architecture.

## Neutral representation and identity

A supported neutral TEXT contains decoded content, its authoritative alignment point, positive height, authored rotation in degrees, native-compatible horizontal alignment, layer/property metadata, source handle, and source position. Mapping creates a native Text through `recordGateway.createText`, which canonicalizes rotation and allocates fresh record and insertion-feature IDs. DXF handles never become identity, and no projected bounds or font measurements are persisted.

## Alignment

Baseline Left (`72=0`, `73=0`) uses the first alignment point from groups 10/20. Baseline Center and Right (`72=1` or `2`, `73=0`) use the second alignment point from groups 11/21; the first point is deliberately ignored, matching DXF justification semantics. A missing required second point is malformed supported data and fails the import.

Vertical Bottom/Middle/Top justification and horizontal Aligned/Middle/Fit cannot be represented by Caderact's current baseline Left/Center/Right model. They are skipped with `DXF_TEXT_JUSTIFICATION_UNSUPPORTED`, never approximated.

## Content, height, rotation, and encoding

Height must be finite and positive. Content must be nonblank, contain no unsupported control characters, and fit the native 256-code-unit limit after decoding. Malformed values are fatal.

Rotation is parsed in DXF degrees and converted to radians by the mapper; native `AnnotationGeometry.normalizeRotation` canonicalizes it to `[0, 2π)`, preserving authored wraparound.

Already-decoded Unicode is retained. DXF4 centrally decodes the common `\\U+XXXX` escape form, including paired UTF-16 escapes. It does not claim general legacy code-page conversion or interpret rich-text formatting.

## Styles and formatting losses

DXF4 does not import Text Styles or fonts. A non-Standard style name is diagnosed with `DXF_TEXT_STYLE_IGNORED`, while the semantic text imports using native annotation styling. Non-default width factor, nonzero oblique angle, and mirrored/upside-down generation flags materially change geometry that the native model cannot preserve, so those entities are skipped with `DXF_TEXT_FORMATTING_UNSUPPORTED`.

`MTEXT` is skipped with `DXF_MTEXT_UNSUPPORTED`; it is never flattened into single-line Text. Multiline content, inline formatting, columns, and rich text remain unsupported.

## Planarity and properties

First and relevant second alignment Z values must be zero, thickness must be zero, and extrusion must be the default `(0, 0, 1)`. Other OCS/3D cases are skipped with `DXF_TEXT_NON_PLANAR` and are never projected.

TEXT passes through the exact DXF3 layer and object-property mapper. ByLayer, ACI/true color, linetype, lineweight, BYBLOCK fallbacks, hidden layers, and locked layers therefore have the same behavior as geometry authored natively. Text remains outside curve, measurement, Osnap, and tracking authorities.

## Atomicity and DXF5 boundary

Malformed supported TEXT fails construction of the isolated store and leaves the active document unchanged. Valid but unsupported semantics skip only that entity with a structured diagnostic, allowing supported geometry and Text to import together.

Deferred work includes MTEXT, Text Styles/fonts, arbitrary encoding conversion, multiline/rich text, Fit/Aligned approximation, arbitrary OCS conversion, Dimensions/DIMSTYLE, Blocks, Hatch, export, and merge import.
