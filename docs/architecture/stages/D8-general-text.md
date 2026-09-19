# D8 — General Text / Annotation Foundation

## Scope and schema

D8 adds native, single-line plain-text records without introducing rich text or named Text Styles. A Text record owns a stable record ID, one feature-bearing `insertionPoint`, Unicode `text`, positive model-space `height`, canonical `rotation` in radians in `[0, 2π)`, horizontal alignment (`left`, `center`, or `right`), layer, and normal object appearance properties. Content is limited to 256 characters, must contain a visible non-whitespace character, and rejects control characters.

Persistence remains version 3. Adding Text extends the closed v3 record union but does not change document-wide structure. Text saves and reloads exact semantic values and IDs; projected position, measured width, bounds, selection, grips, and DOM state are never persisted. Existing v1/v2 migration and v3 Dimension Style behavior are unchanged.

## Command

`Text` (alias `DTEXT`) uses the workflow: insertion point → height → rotation → content. Insertion uses the normal resolved point path, including object snap, continuous Grid Snap, tracking, Ortho/Polar where a valid reference exists, typed points, and Dynamic Input. Height defaults to 2.5 model units and rotation defaults to 0 degrees when Enter accepts a default. Content validation is retryable, and publication occurs only after valid content, in one history entry.

The command preview uses the same Text annotation descriptor with a restrained placeholder after insertion. The custom CAD cursor remains at the raw pointer; the semantic candidate remains authoritative.

## Annotation geometry and overlay

`CaderactAnnotationGeometry` is the pure, renderer-neutral authority for validation, canonical rotation, the annotation descriptor, projected approximate bounds, and the insertion grip. It does not depend on DOM or command state. Dimensions remain owned by `DimensionGeometry`; both feed the existing shared pointer-transparent annotation overlay.

Text height is model-space and therefore scales with zoom. Rotation is user-authored and is never readability-flipped. The insertion point is the horizontal anchor: left begins at it, center straddles it, and right ends at it. The existing overlay’s vertical-center anchor is retained as the D8 vertical policy. The application annotation font is reused; no font name is persisted.

Projected bounds are ephemeral and derived from content, height, alignment, rotation, and camera scale. Hit testing and Window/Crossing selection use those bounds without querying DOM nodes. Text is one semantic selectable record, and selected editable Text exposes one insertion-point grip. Grip preview is transient; commit preserves record and feature identity in one transaction.

## Properties and appearance

Homogeneous Text selection exposes Content (single selection), Height, Rotation in degrees, and Alignment, plus the existing Layer, Color, Linetype, and Lineweight controls. Height and rotation support safe homogeneous batch editing. Heterogeneous Text/geometry or Text/dimension selections expose only common object properties. The insertion point is read-only.

Text color resolves through the existing explicit-object-then-layer appearance policy. Linetype and lineweight remain durable common properties but do not alter DOM glyph strokes.

## Transforms and exclusions

Move translates the insertion point. Copy preserves semantic values but allocates fresh record and insertion feature IDs. Rotate transforms the insertion point and adds the transform angle to Text rotation. Positive uniform Scale transforms the insertion point and height. Mirror reflects the insertion point and baseline direction while keeping DOM glyphs readable rather than reversing the glyph shapes; no MIRRTEXT preference is introduced.

Text is excluded from Trim, Extend, Offset, geometric measurement, object-snap candidates, and tracking acquisition. It remains placeable by those drafting aids but does not become a source afterward. Hidden-layer Text is absent from rendering and selection; locked-layer Text remains visible but is not editable or grippable under the shared layer policy.

## Lifecycle, parity, and performance

Creation, property edits, grip edits, transforms, Delete, Undo/Redo, New/Open, layer visibility, pan, zoom, resize, and renderer recovery all rebuild the shared descriptor stream from authoritative records. Canvas2D and WebGPU consume the same scene annotation descriptors and perform no Text measurement or semantic calculations. Pointer hit tests are constant work per Text record using four derived bound edges and never scan DOM nodes.

## Deferred boundary

D9+ may address multiline text, MTEXT, named Text Styles, fonts and formatting, vertical justification, wrapping, annotation scaling, leaders, fields, Text osnaps, and in-canvas WYSIWYG editing. None are part of D8.
