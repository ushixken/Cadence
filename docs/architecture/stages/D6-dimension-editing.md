# D6 — Dimension selection, grips, and properties

## Semantic selection

A native dimension remains one document record. Its extension lines, dimension line, angular arc, radial leader, arrows, and annotation text are renderer-neutral presentation only; none receives a document identity. Point selection derives the current `DimensionGeometry` presentation on demand and applies the standard CSS-pixel aperture and stable nearest-record arbitration. Annotation text is tested through a projected, rotated text rectangle, while its DOM overlay remains pointer-transparent.

Window and Crossing selection project the same visible presentation. Window requires the complete presentation to be contained; Crossing accepts containment or an intersection with any presentation edge. Selection and hit testing are linear in the visible record count and do not scan the DOM or persist derived geometry.

Hidden dimensions are absent from the visible/editable record projections. Locked dimensions follow the L2 policy: they render and remain available as reference geometry, but cannot be selected for editing and expose no grips.

## Selection presentation

Selected dimensions use the shared selection color for extension/dimension/leader lines, angular arcs, arrowheads, and annotation text. Highlighting is derived in `ViewportScene`, is never persisted, and is consumed consistently by Canvas2D and WebGPU.

## Semantic grips and atomic editing

`DimensionGeometry` is the grip authority. Every descriptor maps to an existing persisted feature ID:

- Linear, horizontal, vertical, and aligned: `firstPoint`, `secondPoint`, `dimensionLinePoint`.
- Angular: `firstRayPoint`, `vertex`, `secondRayPoint`, `dimensionArcPoint`.
- Radius and diameter: `centerPoint`, `dimensionPoint`, `leaderPoint`.

The shared grip manager creates a transient replacement record during movement and routes the candidate through the existing grip point-resolution path. Pointer movement creates no document mutation. Acceptance replaces the record once, preserving its record ID, properties, mode, text override, and every semantic feature ID. Invalid linear coincidences, angular degeneracy or zero placement radius, and zero radial radius are refused while the grip edit remains retryable. Cancel creates no history.

## Properties

A single selected dimension shows a user-facing type label, formatted read-only Measurement, read-only `Style: Default`, and definition/placement coordinates. General Layer, Color, Linetype, and Lineweight controls use the existing L3/L4 property gateways and retain normal mixed-selection behavior.

Text Override is editable for a single dimension only. An empty value persists as `null`, restoring automatic formatter output; a non-empty value is stored exactly. The v2 schema permits at most 256 characters and rejects control characters. Each committed change is one ordinary record-replacement history entry with exact Undo/Redo and persistence behavior. Multi-dimension and heterogeneous selections intentionally hide the dimension-specific editor so merely viewing a mixed selection cannot clear overrides.

## Modify-command compatibility

| Command | D6 behavior |
| --- | --- |
| Delete | Deletes the semantic record through the normal atomic transaction. |
| Move | Translates every persisted dimension point and preserves IDs. |
| Copy | Translates a duplicate with a fresh record ID and fresh feature IDs. |
| Rotate | Rotates every persisted point through the shared transform authority. |
| Scale | Uniformly scales every persisted point through the shared transform authority. |
| Mirror | Mirrors every persisted point through the shared transform authority. |
| Offset | Dimension records are not eligible model curves and are refused/excluded. |
| Trim | Derived presentation is not a trim target or cutting curve. |
| Extend | Derived presentation is not an extend target or boundary curve. |

All supported transforms operate on persisted semantic points, not derived presentation. Radial dimensions remain non-associative snapshots; editing or transforming them never changes the source Circle or Arc.

## Lifecycle and persistence

Selection, grip preview, annotation, hit bounds, and Properties values are recomputed from the authoritative record. Commit, cancel, delete, Undo/Redo, layer visibility/locking, and document replacement therefore cannot leave stale annotation or hit geometry. Only semantic v2 dimension records persist; selection, grips, bounds, and presentation primitives do not.

## D7 boundary

D6 does not add associativity, source dependencies, dimension object snaps, named dimension styles, a DimStyle editor, canvas text editing, annotation scale, tolerances, or additional dimension families. Those remain future work.
