# D9 — Dimensions + Annotation Beta Hardening

## Final beta architecture

The annotation subsystem retains one authority chain:

`semantic records → measurement/formatting/style resolution → DimensionGeometry or CaderactAnnotationGeometry → renderer-neutral scene descriptors → shared DOM annotation overlay and graphics scene`

Projected text bounds are derived ephemerally from the current record, resolved style, camera, content, height, rotation, and alignment. They are never stored in the document or history, and pointer hit testing never scans DOM nodes. Canvas2D and WebGPU consume the same scene. Neither renderer nor DOM event handling owns semantic dimension or Text behavior.

The beta semantic record families are horizontal/vertical Linear Dimension, Aligned Dimension, Angular Dimension, Radius Dimension, Diameter Dimension, and single-line Text. Selection identity is always the owning record ID; derived lines, arcs, arrows, glyphs, and bounds are not subobjects.

## Lifecycle and validation guarantees

Annotation commands use the shared command router, point-resolution pipeline, feedback, Dynamic Input, cancellation, and publication boundaries. Invalid geometry or content is retryable and mutation-free. Publication is atomic. Escape clears the active command, preview descriptor, HUD, snap/tracking state, and prompt through the shared lifecycle.

Dimension and Text validation remains centralized in the v3 document schema. Text rotation is canonical in `[0, 2π)`. Dimension formatting normalizes rounded negative zero. Tiny valid linear, angular, and radial presentations remain finite; exact degenerate geometry remains rejected by the existing family-specific policies.

The custom crosshair follows the raw physical pointer. Snap, Track, Grid, preview, HUD, and acceptance use the resolved semantic point. Dimensions and Text are not object-snap or tracking acquisition sources, although their command points and editable grips use the normal drafting pipeline.

## Selection, bounds, and grips

Click and Window/Crossing selection derive from current visible presentation. There is no persistent bound cache, so grip edits, Properties edits, style changes, transforms, Undo/Redo, zoom, pan, resize, layer changes, Delete, New, and Open cannot leave an old cached annotation target. Overlap arbitration remains the existing distance-then-stable-record-ID policy; annotation is not globally preferred.

Each editable semantic point has one stable feature-backed grip. Preview is transient, cancellation is history-free, and commit is one identity-preserving transaction. Invalid dimension grip replacements are rejected before publication. Locked or hidden records expose no editable grips under the shared layer policy.

## Styles, Properties, and overlay UI

Named Dimension Styles remain document-owned stable-ID records with one current style. Commands capture the current style at start. Style creation, duplication, rename/edit, current-style changes, assignment, and permitted deletion use atomic document transactions; referenced, current, and last-style constraints prevent dangling references.

Properties exposes family-appropriate dimension measurement, Style, Text Override, semantic point readouts, and common appearance fields. Text exposes single-selection Content, homogeneous Height/Rotation/Alignment, its insertion point readout, and common appearance fields. Heterogeneous selections expose only semantically common properties and never normalize records merely by opening the panel.

The Dimension Styles manager is a single modal instance. It refreshes from document/history authority, closes on document replacement, restores focus, uses native labelled inputs and buttons, and gives its icon-only close button an accessible name. The annotation overlay replaces its children on every scene submission, preventing duplicate or stale nodes, classes, content, color, transforms, and owner IDs.

## Persistence, history, and layers

Latest persistence remains v3. V1 ordinary geometry migrates unchanged into a valid v3 document. V2 dimension documents receive one deterministic named Standard style and valid style references. V3 round trips semantic records, layers, styles, properties, Text Override, and Text exactly; no derived annotation state is serialized. Malformed records, feature IDs, enums, style references, layer references, and numeric data reject atomically.

Creation, accepted Properties edits, grip commits, style operations, transforms, layer history operations, and Delete are undoable transactions. Selection, hover, previews, manager visibility, tab changes, invalid input, cancellation, zoom, and pan create no history. Hidden annotation is neither rendered nor selectable; locked annotation remains visible but is not editable.

## Beta support matrix

| Type | Create | Select | Window/Crossing | Grips | Properties | Move | Copy | Rotate | Scale | Mirror | Delete | Persist | Osnap source |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Linear Dimension | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Aligned Dimension | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Angular Dimension | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Radius Dimension | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Diameter Dimension | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Text | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No |

Trim, Extend, Offset, and ordinary measurement commands explicitly exclude every annotation row.

## Modify and rendering policies

Move transforms semantic points. Copy allocates fresh record and feature identities. Rotate transforms dimension points and additionally updates Text orientation. Positive uniform Scale transforms semantic points; Text height scales while named Dimension Style values do not. Mirror transforms dimension points and applies Text’s documented readable-glyph baseline policy. Delete and Undo/Redo synchronize both scene and DOM overlay immediately.

Color resolves through normal explicit-object then ByLayer inheritance. Dimension lines honor resolved linetype and lineweight. DOM Text glyphs honor color; their durable linetype and lineweight do not fake font dash or stroke behavior.

## Performance and beta limits

Selection and hit testing are linear over visible records. Each Text bound uses four projected edges. Style lookup is a stable-ID table lookup. Scene derivation performs no DOM scan, no persistent presentation duplication, and no cross-document mutable annotation cache.

D9 intentionally defers MTEXT, multiline/rich text, fonts, named Text Styles, leaders, center/ordinate/baseline/continued dimensions, tolerances, GD&T, annotation scaling, paper space, associativity, annotation osnaps, in-canvas text editing, and exchange-format support.

## D9 findings and fixes

The audit found no data-corruption or stale-bound defect in the renderer-neutral pipeline. Missing regression coverage was added for tiny/extreme dimensions, Text edge values and bound recomputation, overlay deletion/layer cleanup, invalid Text retry/cancellation, repeated Mirror angle normalization, malformed v3 Text rejection, and negative-zero formatting. The local accessibility audit found and fixed the Dimension Styles icon-only close button’s missing accessible name.
