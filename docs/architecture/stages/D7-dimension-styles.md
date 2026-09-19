# D7 — Named Dimension Styles

## Scope

D7 replaces the single document-wide dimension style with a document-owned, ordered table of named styles. Each style has a stable ID, each dimension record stores a `dimensionStyleId`, and the document stores a `currentDimensionStyleId` used by newly started dimension commands.

This stage does not add associative dimensions, dimension object snaps, per-dimension formatting overrides, or style import/export. `textOverride` remains the only record-level presentation override.

## Document and persistence ownership

The internal document and persisted file format are version 3. A new document contains one current style named `Standard`, initialized from `DEFAULT_DIMENSION_STYLE`. Style IDs share the document identity namespace and style names are trimmed, non-empty, case-insensitively unique, and limited to 64 characters.

Version 1 and version 2 files migrate deterministically to version 3. Migration creates one `Standard` style from the legacy defaults or v2 style, assigns every existing dimension to it, and makes it current. Saving always writes the ordered style array, current style ID, and every dimension's style reference. Loading rejects missing, malformed, duplicated, or dangling style data atomically.

Dimension styles are drawing data. Style creation, duplication, rename, edits, deletion, current-style changes, and dimension assignment each publish as one document transaction and therefore participate in Undo/Redo, revision, dirty state, Save, New, and Open.

## Resolution and rendering

`CaderactDocument` is the authority for style validation and lookup. Consumers resolve a dimension record through `reader.resolveDimensionStyle(record)`. `ViewportScene` uses that resolved style to derive renderer-neutral dimension presentation before Canvas2D or WebGPU receives it; renderers contain no style lookup policy.

Changing a shared style updates all dimensions that reference it without rewriting their geometry or feature identities. Selection, crossing tests, measurements, and grip presentation use the same resolved style, so changes to text height, arrow size, gaps, precision, prefix, suffix, unit display, and arrow form invalidate presentation consistently.

A dimension command captures the current style ID when its session starts. Its preview and published record retain that ID even if the current style changes before the command completes. Copy and transform operations preserve the style reference; copied records receive normal fresh record and feature identities.

## Management and Properties UI

The Properties panel exposes a Style selector for homogeneous dimension selections. A mixed multi-selection reports `Mixed`; choosing a style assigns the full editable selection atomically while preserving geometry, record IDs, feature IDs, object properties, and text overrides.

`Manage Styles…` opens one accessible modal manager owned by the Properties UI. It lists the ordered styles and current indicator and supports New, Duplicate, editing/renaming, Set Current, and Delete. Escape and backdrop dismissal close it, focus is restored to the opener, document replacement closes stale UI, and document/history notifications refresh both the manager and Properties panel.

The manager prevents deletion of the current style and any style referenced by a dimension. These restrictions avoid implicit reassignment and dangling references; users must explicitly change the current style or reassign dimensions first.

## Verification boundary

D7 regression coverage includes creation defaults, validation, duplicate names, CRUD history, deletion rules, assignment identity preservation, shared-style propagation, text overrides, command-time style capture, transforms/copy, v1/v2 migration, v3 exact round trips, and Properties/manager lifecycle. Existing linear, aligned, angular, radius, and diameter dimension behavior remains renderer-neutral and non-associative.
